[![Dependency Status](https://david-dm.org/plantain-00/rev-static.svg)](https://david-dm.org/plantain-00/rev-static)
[![devDependency Status](https://david-dm.org/plantain-00/rev-static/dev-status.svg)](https://david-dm.org/plantain-00/rev-static#info=devDependencies)
[![Build Status](https://travis-ci.org/plantain-00/rev-static.svg?branch=master)](https://travis-ci.org/plantain-00/rev-static)
[![npm version](https://badge.fury.io/js/rev-static.svg)](https://badge.fury.io/js/rev-static)
[![Downloads](https://img.shields.io/npm/dm/rev-static.svg)](https://www.npmjs.com/package/rev-static)

## features

#### add version in file name for css and js files

`index.js`

becomes:

`index-caa02e8ba0c5af68e9ac7728da2bed75.js`

#### change file name of css and js files in html files

`<script src="index.js"></script>`

becomes:

`<script src="index-caa02e8ba0c5af68e9ac7728da2bed75.js"></script>`

#### calculate sha for css and js files, then add it in `integrity` property

`<script src="index.js" crossOrigin="anonymous"></script>`

becomes:

`<script src="index-caa02e8ba0c5af68e9ac7728da2bed75.js" crossOrigin="anonymous" integrity="sha256-cHLd68M3ekn8P2d8tYdJIV91nSbWrWsu02yI8MEVvYU="></script>`

#### export versions and sha strings to a json file

`rev-static foo.js bar.css -j version.json`

#### support glob

`rev-static *.js *.css`

#### support config file for options

`rev-static --config rev-static.debug.js`

## usage from cli

1. run `npm i rev-static -g`
2. run `rev-static foo.js bar.ejs.html -o bar.html`

## cli demo in this repository

1. download or clone this repository
2. run `rev-static demo/foo.js demo/bar.css demo/baz.ejs.html demo/qux.ejs.html -o demo/baz.html,demo/qux.html --sha 256`
3. or just run `rev-static`(the options is already in `rev-static.config.js`)

## cli help

```text
rev-static --config rev-static.debug.js
rev-static -v
rev-static --version
```

## develop

check `scripts` part in `package.json` file, then run `npm run [a script name]`.

## change logs

#### v3

+ `noOutputFiles` removed
+ `Usage from nodejs` removed
+ All cli command except `-v`, `--version`, `--config` removed

#### v2

```js
// before
// default configuration file path: rev-static.config.json

// after
// default configuration file path: rev-static.config.js
```

```js
// before
rev.revisionCssJs(["demo/foo.js", "demo/bar.css"], { shaType: 256 }).then(variables => { });

// after
const variables = rev.revisionCssJs(["demo/foo.js", "demo/bar.css"], { shaType: 256 });
```
