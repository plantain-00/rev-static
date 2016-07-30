const rev = require("../dist/index.js");
const versions = rev.revisionCssJs(["demo/foo.js", "demo/bar.css"]);
rev.revisionHtml(["demo/baz.ejs.html", "demo/qux.ejs.html"], ["demo/baz.html", "demo/qux.html"], versions);
