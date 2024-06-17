import { defaultCasURL, loginCAS } from "./cas.js";
import { padDate } from "./utils.js";

export async function retrieveAvailableICs(cookie) {
    const today = new Date();
    let ics = [];

    for (let i = 0; i < 4; i++) {
        const offset = new Date(today);
        offset.setDate(offset.getDate() + i);
        let d = "" + offset.getFullYear() + padDate(offset.getMonth() + 1) + padDate(offset.getDate());
        console.log(d);
        const url = `https://libbooking.gzhu.edu.cn/ic-web/reserve?sysKind=1&resvDates=${d}&page=1&pageSize=10&labIds=101497594&kindId=`;
        const ret = await fetch(url, {
            headers: {
                "Cookie": "ic-cookie=" + cookie
            }
        }).then(res => {
            return res.json();
        });
        ics.push(ret.data);
    }
    return ics;
}

export async function getToken(cookie) {
    const res = await fetch("https://libbooking.gzhu.edu.cn/ic-web/auth/userInfo", {
        headers: {
            "Cookie": "ic-cookie=" + cookie
        }
    });
    const json = await res.json();
    return json.data.token;
}

export async function queryUser(cookie, token, who) {
    const res = await fetch(`https://libbooking.gzhu.edu.cn/ic-web/account/getMembers?key=${who}&page=1&pageNum=10`, {
        headers: {
            "Cookie": "ic-cookie=" + cookie,
            "token": token
        }
    });
    const json = await res.json();
    return {
        token: json.data[0].token,
        accNo: json.data[0].accNo,
        name: json.data[0].logonName
    };
}

// 
// Attempt to book a room, using the accNo we have.
// Please note that accounts is a dict instead of an array.
// 1. Try to book using the account that is unbooked
// 2. Followed by the minimum users required to, you know, book.
// 3. Perform the bookage
// 4. If failed, we probably have booked using this account. So set state, and switch account.
//
export async function book(cookie, room, currentAccount, begin, end, accounts) {
    async function bookUsing(master, accounts, cookie, token, begin, end) {
        let resvMember = [];
        let appAccNo = "";
        for (const acc of accounts) {
            const user = await queryUser(cookie, token, acc);
            resvMember.push(user.accNo);
            if (acc == master) {
                appAccNo = user.accNo;
            }
        }

        // 
        // Format beginTime and endTime
        //
        const resvBeginTime = `${begin.getFullYear()}-${padDate(begin.getMonth() + 1)}-${padDate(begin.getDate())} ${padDate(begin.getHours())}:${padDate(begin.getMinutes())}:${padDate(begin.getSeconds())}`;
        const resvEndTime = `${end.getFullYear()}-${padDate(end.getMonth() + 1)}-${padDate(end.getDate())} ${padDate(end.getHours())}:${padDate(end.getMinutes())}:${padDate(end.getSeconds())}`;
        let bookData = {
            "sysKind": 1,
            "appAccNo": appAccNo,
            "memberKind": 2,
            "resvBeginTime": resvBeginTime,
            "resvEndTime": resvEndTime,
            "testName": "学习",
            "resvKind": 2,
            "resvProperty": 0,
            "appUrl":"",
            "resvMember": resvMember,
            "resvDev": [room.roomID],
            "memo": "Sentinel",
            "captcha": "",
            "addServices": []
        };

        console.log(JSON.stringify(bookData), token, cookie);
        const response = await fetch("https://libbooking.gzhu.edu.cn/ic-web/reserve", {
            headers: {
                "token": token,
                "Cookie": "ic-cookie=" + cookie,
                "Content-Type": "application/json;charset=UTF-8"
            },
            method: "POST",
            mode: "cors",
            body: JSON.stringify(bookData)
        });
        const json = await response.json();
        if (json.code == 0) {
            return true;
        }
        console.log("Cannot book ", room.roomName, " using ", master, ": " , json.message);
        return false;
    }

    accounts[currentAccount].cookie = cookie;

    // 
    // Step 1. Check if the first master has been booked.
    // Step 2. If yes, pick another master, and companies.
    // Step 3. Perform booking.
    // lastBooked should be set to the last second of today after a successful booking.
    // 
    for (let acc in accounts) {
        if (accounts[acc].lastBooked.getTime() >= begin.getTime() || accounts[acc].skipper || accounts[acc].quota + 4 >= 60) {
            continue;
        }
        if (accounts[acc].token == "" || accounts[acc].cookie == "") {
            const casJSON = await (await fetch(defaultCasURL)).json();
            const ret = await loginCAS(casJSON.data, acc, accounts[acc].password);
            accounts[acc].cookie = ret.ic;
            const token = await getToken(accounts[acc].cookie);
            accounts[acc].token = token;
            console.log("Token of ", acc, ":", token);
            console.log("Cookie of ", acc, ":", accounts[acc].cookie);
        }
        
        //
        // Pick companies.
        //
        let companies = [];
        for (let com in accounts) {
            if (com == acc) {
                continue;
            }
            companies.push(com);
            if (companies.length >= room.minUser - 1) {
                break;
            }
        }
        companies.push(acc);
        if (companies.length < room.minUser) {
            return {
                ok: false,
                reason: "人数不足"
            };
        }
        const result = await bookUsing(acc, companies, accounts[acc].cookie, accounts[acc].token, begin, end);
        // const result = true;
        if (result) {
            return {
                ok: true,
                account: acc,
                company: companies,
                room: room.roomName,
                elapsed: Math.round((end - begin) / 3600000)
            };
        }
    }

    return {
        ok: false,
        reason: "账号全部用尽"
    };
}

export function exploreICs(ics) {
    //
    // For every day, check for vacancies of: 
    // - rooms with maxUser = 2 preferred (+0.5)
    // - rooms starting with C is even more prefered (+1.0)
    // - rooms requiring more than 4 people is just unachievable (skip)
    //
    const prefQueue = [[], [], [], []];
    console.log("ICS:", ics);
    for (let i = 0; i < ics.length; i++) {
        const dayICs = ics[i];
        for (const ic of dayICs) {
            let score = 0;
            if (ic.maxUser == 1) {
                score += 10.0;
            }
            if (ic.maxUser == 2) {
                score += 0.5;
            }
            if (ic.roomName.indexOf("C") >= 0) {
                score += 1.0;
            }
            if (ic.roomName.indexOf("C05") >= 0 || 
                ic.roomName.indexOf("E03") >= 0) {
                score += 0.5;
            }
            if (ic.roomName.indexOf("E10") >= 0 ||
                ic.roomName.indexOf("E12") >= 0) {
                continue;
            }
            if (ic.roomName.indexOf("E19") >= 0) {
                score -= 0.5;
            }
            if (ic.minUser == 3) {
                score -= 0.5;
            }
            if (ic.minUser >= 4) {
                continue;
            }
            
            // Insert into prefQueue (treat it like a priority queue)
            const q = prefQueue[i];
            let inserted = false;
            const room = {
                score: score,
                roomID: ic.devId,
                resvInfo: ic.resvInfo,
                roomName: ic.roomName,
                minUser: ic.minUser
            };
            for (let j = 0; j < q.length; j++) {
                if (q[j].score < score) {
                    q.splice(j, 0, room);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) {
                q.push(room);
            }
        }
    }

    for (let i = 0; i < prefQueue[3].length; i++) {
        console.log(prefQueue[3][i].roomName, prefQueue[3][i].score);
    }
    

    // 
    // Check booking state of everyday
    // Booking logic: 
    // 1. search down the queue and attempt to book for 4 hours
    //    4 hours stands for starting from at least the current next time period
    //    (so if it's afternoon, look for evening and if its already evening, skip)
    // 2. if it is impossible to place the 4 hour gap, report failure
    // 3. if there is nothing to book, report failure
    //
    // Since it can only be today, so we can only fail appointments on today using the time method
    //
    let decision = [[null, null], [null, null], [null, null], [null, null]];
    let now = new Date();
    for (let i = 0; i < ics.length; i++) {
        for (let slot = 0; slot < 2; slot++) {
            if ((i == 0 && slot == 0 && now.getHours() >= 12) ||
                (i == 0 && slot == 1 && now.getHours() >= 16)) {
                continue
            }
            
            //
            // Search for 4 hour long empty slots
            //
            for (let j = 0; j < prefQueue[i].length; j++) {
                const r = prefQueue[i][j];
                let slotAvailable = true;
                for (const rInfo of r.resvInfo) {
                    const startTime = new Date(rInfo.startTime);
                    const endTime = new Date(rInfo.endTime);
                    switch (slot) {
                        case 0: // Afternoon slot
                            if (!(endTime.getHours() < 14 || startTime.getHours() >= 18)) {
                                slotAvailable = false;
                                if (i == 3) {
                                    console.log("Skipping afternoon ", r.roomName, " because:", rInfo.title, rInfo.trueName, new Date(rInfo.startTime), new Date(rInfo.endTime));
                                }
                            }
                            break;

                        case 1: // Evening slot 
                            if (startTime.getHours() >= 18 || endTime.getHours() >= 18) {
                                slotAvailable = false;
                                if (i == 3) {
                                    console.log("Skipping night ", r.roomName, " because:", rInfo.startTime, rInfo.endTime);
                                }
                            }
                            break;
                    }
                    if (!slotAvailable) {
                        break;
                    }
                }
                if (slotAvailable) {
                    decision[i][slot] = r;
                    // Put one in front of it so we always prioritize it
                    prefQueue[i].splice(0, 0, r);
                    break;
                }
            }
        }
    }

    console.log("We are going to book: ");
    for (let i = 0; i < decision.length; i++) {
        console.log("Day", i, ":");
        const r1 = decision[i][0];
        const r2 = decision[i][1];
        if (r1 != null) {
            console.log("1400 ~ 1800:", r1.roomName, " score: ", r1.score, " requires", r1.minUser, "users");
        } else {
            console.log("1400 ~ 1800: can't book");
        }
        if (r2 != null) {
            console.log("1800 ~ 2130:", r2.roomName, " score: ", r2.score, " requires", r1.minUser, "users");
        } else {
            console.log("1800 ~ 2130: can't book");
        }
    }

    return decision;
}
