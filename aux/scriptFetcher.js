import fetch from "node-fetch";
import fs from "fs";

const list = [
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-00827bfa.e00c8b72.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-098f08a2.ab79b9b7.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-0f242a8a.01e7796c.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-0f92fba1.8f6ca5a4.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-22588360.a56ed9e7.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-2b24ee5d.13d2905b.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-2d0c1b2e.5ee94522.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-2d0e66f7.053d9f04.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-2d21d0c2.090e3250.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-2e46fea2.f146cb7a.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-40c46c98.9bad027e.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-410e043c.fe0b364a.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-43c3f65c.245b1bf6.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-47efe1c3.30a6531d.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-49567a48.2f78628f.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-4c8786f9.7defbe84.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-58fa388e.1a032773.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-5fcee301.31f38cc6.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-68365058.4bf27e38.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-7561d098.0a2e8f4a.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-78af635a.7b2881e0.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-7a0194d3.89120a68.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-7e2b1910.749df52a.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-8738ce80.fb0c7952.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-ae7794b2.43bbda29.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-c6174b1a.5ecec57d.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-f20622f6.cd0fd518.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-common.ac643941.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-vendors.9c5de52c.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/index.da0a79e3.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-vendors.9c5de52c.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/chunk-common.ac643941.js",
    "http://libbooking.gzhu.edu.cn/static/2.2.20220601/js/index.da0a79e3.js"
];

list.forEach(el => {
    fetch(el).then(res => {
        return res.text();
    }).then(text => {
        const comps = el.split("/");
        fs.writeFileSync(comps[comps.length - 1], text);
    });
});
