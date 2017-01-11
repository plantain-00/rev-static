import * as ejs from "ejs";
import * as fs from "fs";
import * as crypto from "crypto";
import * as minimist from "minimist";
import * as camelcase from "camelcase";
import * as path from "path";
import * as glob from "glob";
import * as Promise from "bluebird";
const flatten = require("lodash.flatten");
const uniq = require("lodash/uniq");
const packageJson: { version: string } = require("../package.json");

function md5(str: string): string {
    return crypto.createHash("md5").update(str).digest("hex");
}

function calculateSha(str: string, shaType: 256 | 384 | 512): string {
    return crypto.createHash(`sha${shaType}`).update(str).digest("base64");
}

function showToolVersion() {
    console.log(`Version: ${packageJson.version}`);
}

const defaultConfigName = "rev-static.config.json";

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
    console.log("   rev-static --config rev-static.debug.json");
    console.log("Options:");
    console.log("  -o, --out [files]    output html files, seperated by ',' if there are more than 1 file.");
    console.log("  -h, --help           print this message.");
    console.log("  -j, --json [file]    output the variables in a json file, can be used by back-end templates.");
    console.log("  -v, --version        print the tool's version.");
    console.log("  -- [ejsOptions]      set the ejs' options, eg, `delimiter` or `rmWhitespace`.");
    console.log("  --sha [type]         calculate sha of files, type can be `256`, `384` or `512`.");
    console.log(`  --config [file]      set the configuration file path, the default configuration file path is '${defaultConfigName}'.`);
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
export function revisionCssJs(
    inputFiles: string[],
    options?: {
        customNewFileName?: (filePath: string, fileString: string, md5String: string, baseName: string, extensionName: string) => string;
        delimiter?: string;
        shaType?: 256 | 384 | 512 | undefined;
    }): Promise<{ sri: { [name: string]: string } } & { [name: string]: string }> {
    const variables = ((options && options.shaType) ? { sri: {} } : {}) as { sri: { [name: string]: string } } & { [name: string]: string };
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
            if (options && options.shaType) {
                variables.sri[variableName] = `sha${options.shaType}-` + calculateSha(fileString, options.shaType);
            }
        }
        return variables;
    });
}

function getOutputFiles(inputFiles: string[], outputFiles: string[] | ((file: string) => string)) {
    if (typeof outputFiles === "function") {
        return Promise.all(inputFiles.map(f => globAsync(f))).then(files => uniq(flatten(files)).map((f: string) => (outputFiles as (file: string) => string)(f)));
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
    ejsOptions?: ejs.Options,
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

    let config: string | undefined = argv["config"];
    if (!config) {
        config = defaultConfigName;
    }
    const configPath = path.resolve(process.cwd(), config);

    let configData: {
        inputFiles: string[];
        outputFiles: string[];
        json?: boolean;
        ejsOptions?: ejs.Options;
        sha?: 256 | 384 | 512;
    };
    try {
        configData = require(configPath);
    } catch (error) {
        const outFilesString: string = argv["o"] || argv["out"];
        if (typeof outFilesString !== "string") {
            console.log(`Error: invalid parameter: "-o".`);
            showHelpInformation();
            return;
        }
        const shaType: 256 | 384 | 512 | undefined = argv["sha"];
        if (shaType) {
            if ([256, 384, 512].indexOf(shaType) === -1) {
                console.log("Error: invalid parameter `sha`.");
                showHelpInformation();
                return;
            }
        }
        configData = {
            inputFiles: argv["_"],
            outputFiles: outFilesString.split(","),
            json: argv["j"] || argv["json"],
            sha: shaType,
        };
        if (argv["--"]) {
            const ejsArgv = minimist(argv["--"]);
            delete ejsArgv._;
            configData.ejsOptions = ejsArgv;
        } else {
            configData.ejsOptions = {};
        }
    }

    if (!configData.inputFiles || configData.inputFiles.length === 0) {
        console.log("Error: no input files.");
        showHelpInformation();
        return;
    }

    const htmlInputFiles: string[] = [];
    const jsCssInputFiles: string[] = [];

    for (const file of configData.inputFiles) {
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
    revisionCssJs(jsCssInputFiles, { shaType: configData.sha }).then(newFileNames => {
        console.log(`New File Names: ${JSON.stringify(newFileNames, null, "  ")}`);
        if (configData.json === true) {
            console.log(`Warn: expect path of json file.`);
        } else if (typeof configData.json === "string") {
            fs.writeFile(configData.json, JSON.stringify(newFileNames, null, "  "), error => {
                if (error) {
                    console.log(error);
                } else {
                    console.log(`Success: to "${configData.json}".`);
                }
            });
        }

        revisionHtml(htmlInputFiles, configData.outputFiles, newFileNames, { ejsOptions: configData.ejsOptions });
    }, (error: Error) => {
        console.log(error);
        showHelpInformation();
    });
}
