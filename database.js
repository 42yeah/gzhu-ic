import sqlite3 from "sqlite3";

const db = new sqlite3.Database("sentinel.sqlite3");

db.serialize(() => {
	// NOTE with `cookie` and `lastlogin`, we can get loginCAS to do lazy login every 30 mins
    db.run("CREATE TABLE IF NOT EXISTS users (username TEXT, password TEXT, main INTEGER, status TEXT, cookie TEXT, lastlogin DATE)");
    db.run("CREATE TABLE IF NOT EXISTS bookInfo (date TEXT, slot INTEGER, status TEXT);");
});

export function listUsers() {
    return new Promise((resolve, reject) => {
        db.all("SELECT username, status, main FROM users", (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export function listUsersInternal() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM users", (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export function updateUser(username, status) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE users SET status=? WHERE username=?", status, username, err => {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    })
}

export function addUser(username, password) {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM users WHERE main=1", (err, rows) => {
            let main = 0;
            if (rows.length == 0) {
                main = 1;
            }
            let status = {
                lastBooked: new Date(0),
                skipper: false,
                quota: 0 // This unit is in hours
            };
            db.run("INSERT INTO users (username, password, main, status, cookie, lastlogin) VALUES (?, ?, ?, ?, ?, ?)", username, password, main, JSON.stringify(status), "", new Date(0), err => {
                if (err) {
                    reject(err);
                } else {
                    resolve(true);
                }
            });
        });
    });
}

export function hasCachedIC(username) {
	return new Promise((resolve, reject) => {
        db.all("SELECT * FROM users WHERE username=?", username, (err, rows) => {
            const now = new Date();
			if (rows.length == 0) {
				resolve(false);
				return;
			}
			const entry = rows[0];
			const elapsed = now - new Date(entry.lastlogin);
			if (elapsed > 1800000) {
				// The login has expired and now we have to try again.
				resolve(false);
				return;
			}
			// Otherwise, just return the IC.
			resolve(entry.cookie);
        });
    })
}

export function loginUser(username, ic) {
	return new Promise((resolve, reject) => {
        db.all("UPDATE users SET cookie=?, lastlogin=? WHERE username=?", ic, new Date(), username, (err, rows) => {
			if (err) {
				reject(err);
			} else {
				resolve(true);
			}
        });
    })
}

export function removeUser(username) {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM users WHERE username=?", username, err => {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}

export function selectUser(username) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE username=?", username, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

export function selectMainUser() {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE main=1", (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

function getRecentBookInfoInternal() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM bookInfo WHERE date < date('now', '+4 days') AND date >= date('now')", (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        })
    });
}

export function addBookInfo(date, slot, status) {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO bookInfo (date, slot, status) VALUES (" + date + ", ?, ?)", slot, status, err => {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}

export function getBookInfo() {
    return new Promise(async (resolve, reject) => {
        const books = await getRecentBookInfoInternal();
        if (books.length % 2 != 0) {
            reject("Not supposed to be odd");
            return;
        }
        //
        // Check for missing days and insert them
        //
        if (books.length < 8) {
            for (let i = books.length; i < 8; i++) {
                let dayOffset = Math.floor(i / 2);
                let slot = i % 2;
                if (!await addBookInfo(`date('now', '+${dayOffset} days')`, slot, JSON.stringify({
                    done: false,
                    master: "",
                    room: "",
                    company: []
                }))) {
                    reject("Not supposed to go wrong");
                    return;
                };
            }
        }

        const finalBooks = await getRecentBookInfoInternal();
        if (finalBooks.length < 8) {
            reject("Not supposed to be like this");
            return;
        } else if (finalBooks.length > 8) {
            reject("Way too many books");
            return;
        }
        resolve(finalBooks);
    });
}

export function updateBookInfo(date, slot, newStatus) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE bookInfo SET status=? WHERE date=" + date + " AND slot=?", newStatus, slot, err => {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}
