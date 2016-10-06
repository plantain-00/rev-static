/// <reference path="../dist/index.d.ts" />
const rev = require("../dist/index.js");
rev.revisionCssJs(["demo/foo.js", "demo/bar.css"], { shaType: 256 }).then(variables => {
    rev.revisionHtml(["demo/baz.ejs.html", "demo/qux.ejs.html"], ["demo/baz.html", "demo/qux.html"], variables);
}, error => {
    console.log(error);
});
