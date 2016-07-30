## usage from cli

+ `npm i rev-static -g`
+ `rev-static foo.js bar.ejs.html -o bar.html`
+ show demo: `rev-static demo/foo.js demo/bar.css demo/baz.ejs.html demo/qux.ejs.html -o demo/baz.html,demo/qux.html`

## usage from nodejs

```js
var rev = require("rev-static");
var versions = rev.revisionCssJs(["foo.js", "bar.css"]);
rev.revisionHtml(["baz.ejs.html", "qux.ejs.html"], ["baz.html", "qux.html"], versions);
```

## develop

+ `npm run init`
+ `npm i`
