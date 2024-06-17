const API_URL = "/api";

let currentDay = 0;
let currentSlot = 0;
let currentUser = 0;
let bookInfo = [];
let users = [];

function api(what) {
    return API_URL + what;
}

const logBox = document.querySelector(".log-box");

function log(what) {
    logBox.innerHTML += what + "<br>";
    logBox.scrollTo(0, logBox.scrollHeight);
}

function listBookInfos() {
    fetch(api("/books")).then(res => { return res.json() }).then(data => {
        console.log(data);
        for (let i = 0; i < data.length; i++) {
            const indicator = document.querySelector("#ind-" + i);
            data[i].status = JSON.parse(data[i].status);
            if (data[i].status.failed) {
                indicator.classList.add("failed");
            } else {
                indicator.classList.remove("failed");
                if (data[i].status.done) {
                    indicator.classList.add("booked");
                } else {
                    indicator.classList.remove("booked");
                }
            }
        }
        bookInfo = data;
        selectBook(currentDay * 2 + currentSlot);
    });
}

function listUsers() {
    fetch(api("/users")).then(res => { return res.json() }).then(data => {
        const usersHTML = document.querySelector(".users");
        if (data.length == 0) {
            usersHTML.innerHTML = "";
            currentUser = 0;
            return;
        }
        users = data;
        usersHTML.innerHTML = "";
        for (let i = 0; i < data.length; i++) {
            usersHTML.innerHTML += `<div class="user-entry" id="user-${i}">${data[i].username}</div>`;
        }
        selectUser();
    });
}

function selectUser() {
    if (currentUser >= users.length) {
        currentUser = 0;
    } else if (currentUser < 0) {
        currentUser = users.length - 1;
    }
    if (users.length == 0) {
        return;
    }
    document.querySelectorAll(".user-entry").forEach(u => {
        u.classList.remove("selected-user");
    });
    const u = document.querySelector("#user-" + currentUser);
    u.classList.add("selected-user");
    const usersHTML = document.querySelector(".users");
    usersHTML.scrollTo(0, u.offsetTop - usersHTML.offsetTop - 30);

    const status = JSON.parse(users[currentUser].status);
    const detail = document.querySelector(".user-detail");
    let skipper = status.skipper ? "是" : "否";
    detail.innerHTML = `最近订场于 ${status.lastBooked}<br>是否不主动预定？ ${skipper}<br>本月已订走：${status.quota} 小时`;
}

function addUser() {
    const username = document.querySelector("#ic-username").value;
    const password = document.querySelector("#ic-password").value;
    if (username == "" || password == "") {
        log("用户名和密码都不能为空。");
        return;
    }
    fetch(api("/users/add"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username, password
        })
    }).then(res => { return res.json(); }).then(data => {
        log(JSON.stringify(data));
        listUsers();
        selectUser();
    });
}

function deleteUser() {
    if (users.length == 0) {
        log("没有选中用户。");
        return;
    }
    fetch(api("/users/delete"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username: users[currentUser].username
        })
    }).then(res => { return res.json(); }).then(data => {
        log(JSON.stringify(data));
        listUsers();
        selectUser();
    });
}

function skipper(what) {
    if (users.length == 0) {
        log("没有选中用户。");
        return;
    }
    fetch(api("/users/skipper"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username: users[currentUser].username,
            skipper: what
        })
    }).then(res => { return res.json(); }).then(data => {
        log(JSON.stringify(data));
        listUsers();
    });
}

function testUser() {
    if (users.length == 0) {
        log("没有选中用户。");
        return;
    }
    fetch(api("/users/test"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username: users[currentUser].username
        })
    }).then(res => { return res.json(); }).then(data => {
        if (!data.ok) {
            log("登陆测试不通过。可能是密码错误？");
        } else {
            log("登陆测试通过。");
        }
    });
}

function setQuota() {
    if (users.length == 0) {
        log("没有选中用户。");
        return;
    }
    const quota = document.querySelector("#ic-username").value;
    if (isNaN(quota)) {
        log("无效时长。");
        return;
    }
    fetch(api("/users/quota"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username: users[currentUser].username,
            quota: +quota
        })
    }).then(res => { return res.json(); }).then(data => {
        log(JSON.stringify(data));
        listUsers();
    });
}

function selectBook(i) {
    document.querySelectorAll(".indicator-light").forEach(l => {
        l.classList.remove("selected");
    });
    document.querySelector("#ind-" + i).classList.add("selected");
    if (bookInfo.length <= i) {
        return;
    }
    const msg = document.querySelector(".book-message");
    const book = bookInfo[i];
    msg.innerHTML = "";
    msg.innerHTML += book.date + " 的 ";
    if (book.slot == 0) {
        msg.innerHTML += " 下午<br />";
    } else {
        msg.innerHTML += " 晚上<br />";
    }
    if (book.status.failed) {
        msg.innerHTML += "该场地预订失败。";
    } else if (!book.status.done) {
        msg.innerHTML += "该场地还没有预订。";
    } else {
        let company = "";
        for (let c of book.status.company) {
            company += c + ", ";
        }
        if (book.status.company.length == 0) {
            company = "无";
        }
        msg.innerHTML += `该场地已经️预订。<br>预订人：${book.status.master}<br>房间：${book.status.room}<br>同行者：${company}`;
    }
    
}

function cleanLog() {
    logBox.innerHTML = "";
}

function preview() {
    log("正在拉取最佳解决方案...");
    fetch(api("/preview"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            index: currentDay * 2 + currentSlot
        })
    }).then(res => { return res.json() }).then(data => {
        if (!data.ok) {
            log("拉取失败。检查主账号。");
            return;
        }
        if (data.room == null) {
            log(`今天已经无法预订。`);
        } else {
            log(`将会订阅 ${data.room.roomName}，分数为 ${data.room.score}。`);
        }
    });
}

function slotName(slot) {
    if (slot == 0) {
        return "下午";
    }
    return "晚上";
}

function markDone(done) {
    fetch(api("/book/set-status"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            day: currentDay,
            slot: currentSlot,
            done: done
        })
    }).then(res => { return res.json(); }).then(json => {
        let d = done ? "完成" : "未完成";
        if (json.ok) {
            log(`${bookInfo[currentDay * 2 + currentSlot].date} 的 ${slotName(currentSlot)} 已标记为 ${d}。`);
            listBookInfos();
        } else {
            log(`无法标记 ${bookInfo[currentDay * 2 + currentSlot].date} 的 ${slotName(currentSlot)}。`);
        }
    });
}

function book() {
    fetch(api("/book"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            day: currentDay,
            slot: currentSlot,
        })
    }).then(res => { return res.json(); }).then(json => {
        if (json.ok) {
            log(`${bookInfo[currentDay * 2 + currentSlot].date} 的 ${slotName(currentSlot)} 已预订。`);
        } else {
            log(`无法预订 ${bookInfo[currentDay * 2 + currentSlot].date} 的 ${slotName(currentSlot)}。<br>因为：${json.reason}。`);
        }
        listBookInfos();
    });
}


listBookInfos();
listUsers();
