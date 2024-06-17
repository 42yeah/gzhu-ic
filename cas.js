//
// Gets through the GZHU cas.
//

import { strEnc } from "./stringEnc.js";
import { loginUser, hasCachedIC } from "./database.js"; 

function makeCookieString(cookies) {
    let cookieString = "";
    cookies.forEach(cookie => {
        cookieString += cookie.split("; ")[0] + "; ";
    });
    return cookieString.slice(0, cookieString.length - 2);
}

async function skipAround(fetchReq) {
    let response = await fetchReq;
    let cookieString = "";
    let ic = "";
    while (response.status == 302) {
        if (response.headers.get("set-cookie")) {
            cookieString = makeCookieString(response.headers.get("set-cookie").split("; "));
        }

        let location = response.headers.get("location");
        if (!location.startsWith("http")) {
            location = "https://newcas.gzhu.edu.cn" + location;
        }
        response = await fetch(location, {
            redirect: "manual",
            headers: {
                "Cookie": cookieString
            }
        });

        //
        // Try to capture ic-cookie, which is what we need
        //
        if (response.headers.get("set-cookie")) {
            const cookies = response.headers.get("set-cookie").split("; ");
            console.log("Cookies:", cookies);
            for (const c of cookies) {
                const kv = c.split("=");
                if (kv[0] == "ic-cookie") {
                    ic = kv[1];
                    break;
                }
            }
        }
    }
    
    return {
        response,
        ic
    };
}

export async function loginCAS(casURL, username, password) {
    let baseCookies = "";
    console.log("Fetching login CAS:", casURL);

	const ic = await hasCachedIC(username);
	if (ic != false) {
		return {
			response: null,
			ic // What we need is the IC-cookie anyway
		};
	}

	// === The following will perform an IC login === //
	const res = await fetch(casURL);
	const text = await res.text();

	// [NOTE] Match the tag "lt".
    const ltExp = /<input type="hidden" id="lt" name="lt" value="(.+)" \/>/g;
    let matches = text.matchAll(ltExp);
    let lt = "";
    for (const match of matches) {
        lt = match[1];
        break;
    }
    
    // [NOTE] Match the tag "execution".
    let execution = "";
    const exExp = /<input type="hidden" name="execution" value="(.+)" \/>/g;
    matches = text.matchAll(exExp);
    for (const match of matches) {
        execution = match[1];
        break;
    }

    // [NOTE] Match the form "action".
    const formActionExp = /<form id="loginForm" class="login-container" action="(.+)" method="post">/g;
    let action = "";
    matches = text.matchAll(formActionExp);
    for (const match of matches) {
        action = match[1];
        break;
    }
    
    // [NOTE] And login!
    const rsa = strEnc(username + password + lt, "1", "2", "3");
    const ul = username.length;
    const pl = password.length;
    const _eventId = "submit";
    const formData = `rsa=${rsa}&ul=${ul}&pl=${pl}&lt=${lt}&execution=${execution}&_eventId=${_eventId}`;
    
    const resp = await skipAround(fetch("https://newcas.gzhu.edu.cn" + action, {
        method: "POST",
        mode: "cors",
        redirect: "manual",
        headers: {
            "Cookie": baseCookies,
            "Upgrade-Insecure-Requests": "1",
            "sec-ch-ua": `" Not A;Brand";v="99", "Chromium";v="92"`,
            "User-Agent": `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Host": "newcas.gzhu.edu.cn",
            "Origin": "https://newcas.gzhu.edu.cn"
        },
        body: formData
    }));

	if (resp.ic != null) {
		await loginUser(username, resp.ic);
	} else {
		return null;
	}


	
    
}

export const defaultCasURL = "https://libbooking.gzhu.edu.cn/ic-web/auth/address?finalAddress=https:%2F%2Flibbooking.gzhu.edu.cn&errPageUrl=https:%2F%2Flibbooking.gzhu.edu.cn%2F%23%2Ferror&manager=false&consoleType=16";
