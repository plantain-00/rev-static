[![Dependency Status](https://david-dm.org/plantain-00/rev-static.svg)](https://david-dm.org/plantain-00/rev-static)
[![devDependency Status](https://david-dm.org/plantain-00/rev-static/dev-status.svg)](https://david-dm.org/plantain-00/rev-static#info=devDependencies)
[![Build Status](https://travis-ci.org/plantain-00/rev-static.svg?branch=master)](https://travis-ci.org/plantain-00/rev-static)
[![npm version](https://badge.fury.io/js/rev-static.svg)](https://badge.fury.io/js/rev-static)

## usage from cli

+ `npm i rev-static -g`
+ `rev-static foo.js bar.ejs.html -o bar.html`

## cli demo

`rev-static demo/foo.js demo/bar.css demo/baz.ejs.html demo/qux.ejs.html -o demo/baz.html,demo/qux.html`

## cli help

```text
Syntax:            rev-static [options] [file ...]
Examples:
  %> rev-static foo.js bar.ejs.html -o bar.html
  %> rev-static foo.js bar.css baz.ejs.html -o baz.html
  %> rev-static foo.js bar.css baz.ejs.html qux.ejs.html -o baz.html,qux.html
  %> rev-static foo.js bar.css -j version.json
  %> rev-static foo.js bar.ejs.html -o bar.html -- --rmWhitespace
  %> rev-static *.js bar.ejs.html -o bar.html
Options:
  -o, --out [files]    output html files, seperated by ',' if there are more than 1 file.
  -h, --help           print this message.
  -j, --json [file]    output the variables in a json file, can be used by back-end templates.
  -v, --version        print the tool's version.
  -- [ejsOptions]      set the ejs' options, eg, `delimiter` or `rmWhitespace`.
```

## usage from nodejs

```js
var rev = require("rev-static");
var versions = rev.revisionCssJs(["foo.js", "bar.css"]);
rev.revisionHtml(["baz.ejs.html", "qux.ejs.html"], ["baz.html", "qux.html"], versions);
```

## develop

+ `npm run init`
+ `npm i`
