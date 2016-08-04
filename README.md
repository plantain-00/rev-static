[![Dependency Status](https://david-dm.org/plantain-00/rev-static.svg)](https://david-dm.org/plantain-00/rev-static)
[![devDependency Status](https://david-dm.org/plantain-00/rev-static/dev-status.svg)](https://david-dm.org/plantain-00/rev-static#info=devDependencies)
[![Build Status](https://travis-ci.org/plantain-00/rev-static.svg?branch=master)](https://travis-ci.org/plantain-00/rev-static)
[![npm version](https://badge.fury.io/js/rev-static.svg)](https://badge.fury.io/js/rev-static)
[![Downloads](https://img.shields.io/npm/dm/rev-static.svg)](https://www.npmjs.com/package/rev-static)

## features

+ add version in file name for css and js files
+ change file name of css and js files in html files
+ calculate sha256 for css and js files, then add it in `integrity` property
+ export versions and sha256 strings to a json file
+ support glob

## usage from cli

1. run `npm i rev-static -g`
2. run `rev-static foo.js bar.ejs.html -o bar.html`

## cli demo in this repository

1. download or clone this repository
2. run `rev-static demo/foo.js demo/bar.css demo/baz.ejs.html demo/qux.ejs.html -o demo/baz.html,demo/qux.html --sha 256`

## cli help

```text
Syntax:            rev-static [options] [file ...]
Examples:
   rev-static foo.js bar.ejs.html -o bar.html
   rev-static foo.js bar.css baz.ejs.html -o baz.html
   rev-static foo.js bar.css baz.ejs.html qux.ejs.html -o baz.html,qux.html
   rev-static foo.js bar.css -j version.json
   rev-static foo.js bar.ejs.html -o bar.html -- --rmWhitespace
   rev-static *.js bar.ejs.html -o bar.html
Options:
  -o, --out [files]    output html files, seperated by ',' if there are more than 1 file.
  -h, --help           print this message.
  -j, --json [file]    output the variables in a json file, can be used by back-end templates.
  -v, --version        print the tool's version.
  -- [ejsOptions]      set the ejs' options, eg, `delimiter` or `rmWhitespace`.
  --sha [type]         calculate sha of files, type can be `256`, `384` or `512`.
```

## usage from nodejs

```js
var rev = require("rev-static");
rev.revisionCssJs(["foo.js", "bar.css"]).then(variables => {
    rev.revisionHtml(["baz.ejs.html", "qux.ejs.html"], ["baz.html", "qux.html"], variables);
});
```
## develop

check `scripts` part in `package.json` file, then run `npm run [a script name]`.
