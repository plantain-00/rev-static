/// <reference types="bluebird" />
/// <reference types="ejs" />
import * as ejs from "ejs";
import * as Promise from "bluebird";
/**
 * calculate and return md5 version of all input files
 * copy input files to the versioned files, eg, `foo.js` -> `foo-cb6143ff70a133027139bbf27746a3c4.js`
 * you can change the rule of generating new file names, by the optional `customNewFileName` in `options` parameter
 * return key of the return object, is camelcased file name, eg, `foo/bar.js` -> `fooBarJs`
 * `inputFiles` support glob
 */
export declare function revisionCssJs(inputFiles: string[], options?: {
    customNewFileName?: (filePath: string, fileString: string, md5String: string, baseName: string, extensionName: string) => string;
    delimiter?: string;
}): Promise<{
    [name: string]: string;
}>;
/**
 * generate html files just as the `outputFiles` shows
 * the `inputFiles` should be `ejs` templates, the variables will be `versions` from `revisionCssJs` function
 * the `inputFiles` and `outputFiles` should be one-to-one map, eg, input `["foo.ejs.html", "bar.ejs.html"]` and output `["foo.html", "bar.html"]`
 * the `ejsOptions` in `options` will be transfered to ejs
 * the `outputFiles` can be a function, in this case, `inputFiles` support glob
 */
export declare function revisionHtml(inputFiles: string[], outputFiles: string[] | ((file: string) => string), newFileNames: {
    [name: string]: string;
}, options?: {
    ejsOptions?: ejs.Options;
}): void;
export declare function executeCommandLine(): void;
