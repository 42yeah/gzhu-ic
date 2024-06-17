import express from "express";
import { addUser, getBookInfo, listUsers, listUsersInternal, removeUser, selectMainUser, selectUser, updateBookInfo, updateUser } from "./database.js";
import { defaultCasURL, loginCAS } from "./cas.js";
import cors from "cors";
import { book, exploreICs, retrieveAvailableICs } from "./ic.js";

const app = express();
app.use(express.json());
app.use(cors());
const port = 25319;

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

app.get("/books", (req, res) => {
    getBookInfo().then(books => {
        res.end(JSON.stringify(books));
    });
});

app.get("/users", (req, res) => {
    listUsers().then(users => {
        res.end(JSON.stringify(users));
    });
});

app.post("/users/add", (req, res) => {
    addUser(req.body.username, req.body.password).then(ret => {
        res.end("{\"ok\": true}");
    }).catch(e => {
        res.end(JSON.stringify({
            ok: false,
            reason: e
        }));
    });
});

app.post("/users/delete", (req, res) => {
    removeUser(req.body.username).then(ret => {
        res.end("{\"ok\": true}");
    }).catch(e => {
        res.end(JSON.stringify({
            ok: false,
            reason: e
        }));
    });
});

app.post("/users/skipper", async (req, res) => {
    const u = await selectUser(req.body.username);
    u.status = JSON.parse(u.status);
    u.status.skipper = req.body.skipper;

    await updateUser(u.username, JSON.stringify(u.status));
    res.end("{\"ok\": true}");
});

app.post("/users/quota", async (req, res) => {
    const u = await selectUser(req.body.username);
    u.status = JSON.parse(u.status);
    u.status.quota = req.body.quota;

    await updateUser(u.username, JSON.stringify(u.status));
    res.end("{\"ok\": true}");
});

app.post("/users/test", (req, res) => {
    selectUser(req.body.username).then(u => {
        fetch(defaultCasURL).then(res => {
            return res.json();
        }).then(json => {
            let redirect = json.data;
            return loginCAS(redirect, u.username, u.password);
        }).then(ret => {
            const ic = ret.ic;
            res.end("{\"ok\": " + (ic != "") + "}");
        });
    });
});

app.post("/preview", (req, res) => {
    let index = req.body.index;

    fetch(defaultCasURL).then(r => {
        return r.json();
    }).then(json => {
        return selectMainUser().then(u => {
            let redirect = json.data;
            return loginCAS(redirect, u.username, u.password);
        });
    }).then(ret => {
        console.log(ret);
        const ic = ret.ic;
        return retrieveAvailableICs(ic);
    }).then(ics => {
        const decisions = exploreICs(ics);
        res.end(JSON.stringify({
            ok: true,
            room: decisions[Math.floor(index / 2)][index % 2]
        }));
    }).catch(e => {
        res.end(JSON.stringify({
            ok: false,
            reason: e
        }));
    });
});

app.post("/book/set-status", (req, res) => {
    getBookInfo().then(books => {
        const b = books[req.body.day * 2 + req.body.slot];
        
        if (req.body.done) {
            b.status = {
                done: true,
                master: "无",
                room: "手动设定",
                company: []
            };
        } else {
            b.status = {
                done: false,
                master: "",
                room: "",
                company: []
            };
        }

        return updateBookInfo(`date('now', '+${req.body.day} days')`, req.body.slot, JSON.stringify(b.status));
    }).then(r => {
        res.end("{\"ok\": true}");
    }).catch(e => {
        res.end(JSON.stringify({
            ok: false,
            reason: e
        }));
    });
});

app.post("/book", (req, res) => {
    let cookie = "";
    let mainUser = null;
    let success = false;
    let bookFailedReason = "";

    getBookInfo().then(books => {
        const status = JSON.parse(books[req.body.day * 2 + req.body.slot].status);
        if (status.done || status.failed) {
            throw "本日预订已经成功/失败过了";
        }
        return fetch(defaultCasURL);
    }).then(r => {
        return r.json();
    }).then(json => {
        return selectMainUser().then(u => {
            let redirect = json.data;
            mainUser = u;
            return loginCAS(redirect, u.username, u.password);
        });
    }).then(ret => {
        cookie = ret.ic;
        return retrieveAvailableICs(cookie);
    }).then(async ics => {
        const decisions = exploreICs(ics);
        //
        // Fail the booking if its already booked, or 
        // no decisions could be made.
        // 
        if (decisions[req.body.day][req.body.slot] == null) {
            const status = {
                done: false,
                failed: true,
                master: "",
                room: "",
                company: []
            };
            await updateBookInfo(`date('now', '+${req.body.day} days')`, req.body.slot, JSON.stringify(status));
            throw "无可用场地";
        }

        let begin = new Date();
        let end = new Date();

        if (req.body.slot == 0) {
            begin.setDate(begin.getDate() + req.body.day);
            begin.setHours(14, 0, 0, 0);
            end.setDate(end.getDate() + req.body.day);
            end.setHours(18, 0, 0, 0);
        } else {
            begin.setDate(begin.getDate() + req.body.day);
            begin.setHours(18, 0, 0, 0);
            end.setDate(end.getDate() + req.body.day);
            end.setHours(20, 31, 0, 0);
        }

        console.log("We will be booking: ", decisions[req.body.day][req.body.slot], mainUser.username, begin, end);
        const accountsArray = await listUsersInternal();
        let accounts = {};
        for (const acc of accountsArray) {
            const status = JSON.parse(acc.status);
            accounts[acc.username] = {
                password: acc.password,
                lastBooked: new Date(status.lastBooked),
                skipper: status.skipper,
                cookie: "",
                token: "",
                quota: status.quota
            };
        }

        return book(cookie, decisions[req.body.day][req.body.slot], mainUser.username, begin, end, accounts);
    }).then(async ret => {
        //
        // Update and set status to booked.
        //
        let status = {};
        success = ret.ok;
        bookFailedReason = ret.reason;
        if (ret.ok) {
            status = {
                done: true,
                master: ret.account,
                room: ret.room,
                company: ret.company
            };
            //
            // Update the accounts & companies to today
            //
            let lastBooked = new Date();
            lastBooked.setHours(23);
            lastBooked.setMinutes(59);
            lastBooked.setSeconds(59);
            for (const c of status.company) {
                const u = await selectUser(c);
                u.status = JSON.parse(u.status);
                u.status.lastBooked = lastBooked;

                await updateUser(u.username, JSON.stringify(u.status));
            }
            const master = await selectUser(ret.account);
            console.log("Selecting ", ret.account, " to add booking time");
            master.status = JSON.parse(master.status);
            master.status.quota += ret.elapsed;
            await updateUser(master.username, JSON.stringify(master.status));
        } else {
            status = {
                done: false,
                failed: true,
                master: "",
                room: "",
                company: []
            };
        }
        return updateBookInfo(`date('now', '+${req.body.day} days')`, req.body.slot, JSON.stringify(status));
    }).then(ret => {
        if (success) {
            res.end("{\"ok\": true}");
        } else {
            throw bookFailedReason;
        }
    }).catch(e => {
        console.log(e);
        res.end(JSON.stringify({
            ok: false,
            reason: e
        }));
    });
});

app.listen(25319, () => {
    console.log("Sentinel is listening at", port);
});
