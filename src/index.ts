import * as ejs from "ejs";
import * as fs from "fs";
import * as crypto from "crypto";
import * as minimist from "minimist";
import * as camelcase from "camelcase";
import * as path from "path";
import * as glob from "glob";
import * as Promise from "bluebird";
const packageJson: { version: string } = require("../package.json");
const flatten: <T>(array: T[][]) => T[] = require("lodash.flatten");
const uniq: <T>(array: T[]) => T[] = require("lodash.uniq");

function md5(str: string): string {
    return crypto.createHash("md5").update(str).digest("hex");
}

function showToolVersion() {
    console.log(`Version: ${packageJson.version}`);
}

function showHelpInformation() {
    showToolVersion();
    console.log("Syntax:            rev-static [options] [file ...]");
    console.log("Examples:");
    console.log("   rev-static foo.js bar.ejs.html -o bar.html");
    console.log("   rev-static foo.js bar.css baz.ejs.html -o baz.html");
    console.log("   rev-static foo.js bar.css baz.ejs.html qux.ejs.html -o baz.html,qux.html");
    console.log("   rev-static foo.js bar.css -j version.json");
    console.log("   rev-static foo.js bar.ejs.html -o bar.html -- --rmWhitespace");
    console.log("   rev-static *.js bar.ejs.html -o bar.html");
    console.log("Options:");
    console.log("  -o, --out [files]    output html files, seperated by ',' if there are more than 1 file.");
    console.log("  -h, --help           print this message.");
    console.log("  -j, --json [file]    output the variables in a json file, can be used by back-end templates.");
    console.log("  -v, --version        print the tool's version.");
    console.log("  -- [ejsOptions]      set the ejs' options, eg, `delimiter` or `rmWhitespace`.");
}

function globAsync(pattern: string) {
    return new Promise<string[]>((resolve, reject) => {
        glob(pattern, (error, matches) => {
            if (error) {
                reject(error);
            } else {
                resolve(matches);
            }
        });
    });
}

/**
 * calculate and return md5 version of all input files
 * copy input files to the versioned files, eg, `foo.js` -> `foo-cb6143ff70a133027139bbf27746a3c4.js`
 * you can change the rule of generating new file names, by the optional `customNewFileName` in `options` parameter
 * return key of the return object, is camelcased file name, eg, `foo/bar.js` -> `fooBarJs`
 * `inputFiles` support glob
 */
export function revisionCssJs(inputFiles: string[], options?: {
    customNewFileName?: (filePath: string, fileString: string, md5String: string, baseName: string, extensionName: string) => string;
    delimiter?: string;
}): Promise<{ [name: string]: string }> {
    const variables: { [name: string]: string } = {};
    const delimiter = options && options.delimiter ? options.delimiter : "-";
    return Promise.all(inputFiles.map(f => globAsync(f))).then(files => {
        const allFiles = uniq(flatten(files));
        for (const filePath of allFiles) {
            const variableName = camelcase(path.normalize(filePath).replace(/\\|\//g, "-"));
            const fileString = fs.readFileSync(filePath).toString();
            const md5String = md5(fileString);
            let newFileName: string;
            const extensionName = path.extname(filePath);
            const baseName = path.basename(filePath, extensionName);
            if (options && options.customNewFileName) {
                newFileName = options.customNewFileName(filePath, fileString, md5String, baseName, extensionName);
            } else {

                newFileName = baseName + delimiter + md5String + extensionName;
            }
            fs.createReadStream(filePath).pipe(fs.createWriteStream(path.resolve(path.dirname(filePath), newFileName)));
            variables[variableName] = newFileName;
        }
        return variables;
    });
}

function getOutputFiles(inputFiles: string[], outputFiles: string[] | ((file: string) => string)) {
    if (typeof outputFiles === "function") {
        return Promise.all(inputFiles.map(f => globAsync(f))).then(files => uniq(flatten(files)).map(f => (outputFiles as (file: string) => string)(f)));
    } else {
        if (outputFiles.length !== inputFiles.length) {
            return Promise.reject(`Error: input ${inputFiles.length} html files, but output ${outputFiles.length} html files.`);
        }
        return Promise.resolve(outputFiles);
    }
}

/**
 * generate html files just as the `outputFiles` shows
 * the `inputFiles` should be `ejs` templates, the variables will be `versions` from `revisionCssJs` function
 * the `inputFiles` and `outputFiles` should be one-to-one map, eg, input `["foo.ejs.html", "bar.ejs.html"]` and output `["foo.html", "bar.html"]`
 * the `ejsOptions` in `options` will be transfered to ejs
 * the `outputFiles` can be a function, in this case, `inputFiles` support glob
 */
export function revisionHtml(inputFiles: string[], outputFiles: string[] | ((file: string) => string), newFileNames: { [name: string]: string }, options?: {
    ejsOptions?: ejs.Options
}) {
    getOutputFiles(inputFiles, outputFiles).then(finalOutputFiles => {
        const ejsOptions = options && options.ejsOptions ? options.ejsOptions : {};
        for (let i = 0; i < inputFiles.length; i++) {
            ejs.renderFile(inputFiles[i], newFileNames, ejsOptions, (renderError: Error, file: any) => {
                if (renderError) {
                    console.log(renderError);
                } else {
                    fs.writeFile(finalOutputFiles[i], file, writeError => {
                        if (writeError) {
                            console.log(writeError);
                        } else {
                            console.log(`Success: to "${finalOutputFiles[i]}" from "${inputFiles[i]}".`);
                        }
                    });
                }
            });
        }
    }, error => {
        console.log(error);
        showHelpInformation();
    });

}

export function executeCommandLine() {
    const argv = minimist(process.argv.slice(2), {
        "--": true,
    });
    let ejsOptions: ejs.Options;
    if (argv["--"]) {
        const ejsArgv = minimist(argv["--"]);
        delete ejsArgv._;
        ejsOptions = ejsArgv;
    } else {
        ejsOptions = {};
    }
    const showHelp = argv["h"] || argv["help"];
    if (showHelp) {
        showHelpInformation();
        return;
    }

    const showVersion = argv["v"] || argv["version"];
    if (showVersion) {
        showToolVersion();
        return;
    }
    const inputFiles = argv["_"];
    if (!inputFiles || inputFiles.length === 0) {
        console.log("Error: no input files.");
        showHelpInformation();
        return;
    }
    const htmlInputFiles: string[] = [];
    const jsCssInputFiles: string[] = [];
    for (const file of inputFiles) {
        if (!fs.existsSync(file)) {
            console.log(`Error: file: "${file}" not exists.`);
            showHelpInformation();
            return;
        }
        const extensionName = path.extname(file);
        if ([".html", ".htm", "ejs"].indexOf(extensionName.toLowerCase()) !== -1) {
            htmlInputFiles.push(file);
        } else {
            jsCssInputFiles.push(file);
        }
    }
    revisionCssJs(jsCssInputFiles).then(newFileNames => {
        console.log(`New File Names: ${JSON.stringify(newFileNames, null, "  ")}`);
        const json: string | boolean = argv["j"] || argv["json"];
        if (json === true) {
            console.log(`Warn: expect path of json file.`);
        } else if (typeof json === "string") {
            fs.writeFile(json, JSON.stringify(newFileNames, null, "  "), error => {
                if (error) {
                    console.log(error);
                } else {
                    console.log(`Success: to "${json}".`);
                }
            });
        }

        const outFilesString: string = argv["o"] || argv["out"];
        if (typeof outFilesString !== "string") {
            console.log(`Error: invalid parameter: "-o".`);
            showHelpInformation();
            return;
        }
        const htmlOutputFiles = outFilesString.split(",");
        revisionHtml(htmlInputFiles, htmlOutputFiles, newFileNames, { ejsOptions });
    }, (error: Error) => {
        console.log(error);
        showHelpInformation();
    });
}
