[![Dependency Status](https://david-dm.org/plantain-00/rev-static.svg)](https://david-dm.org/plantain-00/rev-static)
[![devDependency Status](https://david-dm.org/plantain-00/rev-static/dev-status.svg)](https://david-dm.org/plantain-00/rev-static#info=devDependencies)
[![Build Status: Linux](https://travis-ci.org/plantain-00/rev-static.svg?branch=master)](https://travis-ci.org/plantain-00/rev-static)
[![Build Status: Windows](https://ci.appveyor.com/api/projects/status/github/plantain-00/rev-static?branch=master&svg=true)](https://ci.appveyor.com/project/plantain-00/rev-static/branch/master)
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

#### support glob

#### support config file for options

`rev-static --config rev-static.debug.js`

#### inline small js or css file

## install

`npm i rev-static -g`

## usage

```text
rev-static --config rev-static.config.js // config the config file path
rev-static -v
rev-static --version
rev-static --watch
```

## config file

key | type | use case | description
--- | --- | --- | ---
`inputFiles` | `string[]` | `demo/index.js` | the js, css, html and image file paths, can be glob
`excludeFiles` | `string[]?` | `node_modules/foo/bar.js` | the files will be excluded, can be glob
`revisedFiles` | `string[]?` | `demo/foo-caa02eaf68e9a.js` | the files will be regarded as revised files, can be glob
`inlinedFiles` | `string[]?` | `demo/index.css` | the files will be inlined to html files, can be glob
`outputFiles` | `(file: string) => string` | `demo/index.ejs.html`->`demo/index.html` | the output files mapping function
`ejsOptions` | `EjsOption` | rm whitespace | the options to ejs
`sha` | `256` or `384` or `512` or `undefined` | subresource integrity | the sha type for subresource integrity
`customNewFileName` | `(filePath: string, fileString: string, md5String: string, baseName: string, extensionName: string) => string` | `demo/index.js`->`demo/index-caa02eaf68e9a.js` | the rule of generated js, css, image file
`customOldFileName` | `(filePath: string, baseName: string, extensionName: string) => string` | `demo/index-caa02eaf68e9a.js`->`{ demoIndexJs: demo/index-caa02eaf68e9a.js }` | the rule to get revised file's key
`json` | `string?` | | generate json file for other use
`es6` | `string?` | | generate es6 file for image resources
`less` | `string?` | | generate es6 file for image resources
`scss` | `string?` | | generate es6 file for image resources
`base` | `string?` | | for example, if no `base`, the key will be `demoFooJs` or `demoBarCss`, if the `base` is `demo`, the key will be `fooJs` or `barCss`
`fileSize` | `string?` | | generate a json file to show the resource file size

## core structure

```
{
  "sri": {
    "fooJs": "sha256-+dZ6udsWxNVoGfScAq7t5IIF5UJb4F6RhjbN6oe1p4w=",
    "foo2Js": "sha256-472ZphjBz2mNWVsknzB8w8rybok1qJl+LKGkqi4XX54=",
    "barCss": "sha256-up7mALOXxS9RzUpTmUIG02GpdK3MsSiMX1Zvco/4J68=",
    "testPng": "sha256-s6pVclbzXpnC5m5oiDf3vdHQskc3AX1vz6h3HRYHgkQ="
  },
  "fooJs": "foo-cb6143ff70a133027139bbf27746a3c4.js",
  "foo2Js": "foo2-42a7b8c.js",
  "barCss": "bar-84f794affa62674553872916601669fe.css",
  "testPng": "test-9d97966727a2d68e865bd7dcf26202df.png"
}
```

## demo in this repository

1. download or clone this repository
2. run `rev-static`(the options is already in `rev-static.config.js`)

## develop

check `scripts` part in `package.json` file, then run `npm run [a script name]`.

## change logs

#### v3

+ `noOutputFiles` removed
+ `Usage from nodejs` removed
+ All cli command except `-v`, `--version`, `--config` removed, in favor of config file
+ the `outputFiles` cannot be `string[]` any more

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
