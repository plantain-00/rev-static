/// <reference path="../dist/index.d.ts" />
const rev = require("../dist/index.js");
const variables = rev.revisionCssJs(["demo/foo.js", "demo/bar.css", "demo/test.png"], { shaType: 256, base: "demo" });
rev.revisionHtml(["demo/baz.ejs.html", "demo/qux.ejs.html"], ["demo/baz.html", "demo/qux.html"], variables).catch(error => {
    console.log(error);
});
