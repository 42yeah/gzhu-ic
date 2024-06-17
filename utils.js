export function padDate(d) {
    d = "" + d;
    if (d.length == 1) {
        return "0" + d;
    }
    return d;
}
