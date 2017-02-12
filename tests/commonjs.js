/// <reference path="../dist/index.d.ts" />
const rev = require("../dist/index.js");
const variables = rev.revisionCssJs(["demo/foo.js", "demo/bar.css"], { shaType: 256 });
rev.revisionHtml(["demo/baz.ejs.html", "demo/qux.ejs.html"], ["demo/baz.html", "demo/qux.html"], variables).catch(error => {
    console.log(error);
});
