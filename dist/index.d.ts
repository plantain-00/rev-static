/// <reference types="ejs" />
import * as ejs from "ejs";
/**
 * calculate and return md5 version of all input files
 * copy input files to the versioned files, eg, `foo.js` -> `foo-cb6143ff70a133027139bbf27746a3c4.js`
 * return key of the return object, is camelcased file name, eg, `foo/bar.js` -> `fooBarJs`
 */
export declare function revisionCssJs(inputFiles: string[]): {
    [name: string]: string;
};
/**
 * generate html files just as the `outputFiles` shows
 * the `inputFiles` should be `ejs` templates, the variables will be `versions` from `revisionCssJs` function
 * the `inputFiles` and `outputFiles` should be one-to-one map, eg, input `["foo.ejs.html", "bar.ejs.html"]` and output `["foo.html", "bar.html"]`
 */
export declare function revisionHtml(inputFiles: string[], outputFiles: string[], versions: {
    [name: string]: string;
}, ejsOptions?: ejs.Options): void;
export declare function executeCommandLine(): void;
