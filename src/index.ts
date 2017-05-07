import * as ejs from "ejs";
import * as fs from "fs";
import * as crypto from "crypto";
import * as minimist from "minimist";
import * as camelcase from "camelcase";
import * as path from "path";
import * as glob from "glob";
const flatten: <T>(array: T[][]) => T[] = require("lodash.flatten");
const uniq: <T>(array: T[]) => T[] = require("lodash.uniq");
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

const defaultConfigName = "rev-static.config.js";

const htmlExtensions = [".html", ".htm", ".ejs"];

const defaultConfigContent = `module.exports = {
    inputFiles: [
        "demo/foo.js",
        "demo/bar.css",
        "demo/*.ejs.html",
    ],
    outputFiles: file => file.replace(".ejs", ""),
    json: false,
    ejsOptions: {
        rmWhitespace: true
    },
    sha: 256,
    customNewFileName: (filePath, fileString, md5String, baseName, extensionName) => baseName + "-" + md5String + extensionName,
    noOutputFiles: [
        "demo/worker.js",
    ],
};
`;

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
    console.log("   rev-static --config rev-static.debug.js");
    console.log("   rev-static init");
    console.log("Options:");
    console.log("  -o, --out [files]    output html files, seperated by ',' if there are more than 1 file.");
    console.log("  -h, --help           print this message.");
    console.log("  -j, --json [file]    output the variables in a json file, can be used by back-end templates.");
    console.log("  -v, --version        print the tool's version.");
    console.log("  -- [ejsOptions]      set the ejs' options, eg, `delimiter` or `rmWhitespace`.");
    console.log("  --sha [type]         calculate sha of files, type can be `256`, `384` or `512`.");
    console.log(`  --config [file]      set the configuration file path, the default configuration file path is '${defaultConfigName}'.`);
    console.log("  --e, --es6 [file]    output the variables in a es6 file.");
    console.log("  --l, --less [file]   output the variables in a less file.");
    console.log("  --s, --scss [file]   output the variables in a scss file.");
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

function renderEjsAsync(path: string, data: ejs.Data, opts: ejs.Options) {
    return new Promise<string>((resolve, reject) => {
        ejs.renderFile(path, data, opts, (error, file) => {
            if (error) {
                reject(error);
            } else {
                resolve(file!);
            }
        });
    });
}

function writeFileAsync(filename: string, data: string) {
    return new Promise<void>((resolve, reject) => {
        fs.writeFile(filename, data, error => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

function getVariableName(filePath: string) {
    return camelcase(path.normalize(filePath).replace(/\\|\//g, "-"));
}

export type CustomNewFileName = (filePath: string, fileString: string, md5String: string, baseName: string, extensionName: string) => string;

export interface Options {
    customNewFileName?: CustomNewFileName;
    shaType?: 256 | 384 | 512 | undefined;
    noOutputFiles?: string[];
}

function getNewFileName(fileString: string, filePath: string, customNewFileName?: CustomNewFileName) {
    const md5String = md5(fileString);
    const extensionName = path.extname(filePath);
    const baseName = path.basename(filePath, extensionName);
    if (customNewFileName) {
        return customNewFileName(filePath, fileString, md5String, baseName, extensionName);
    } else {
        return baseName + "-" + md5String + extensionName;
    }
}

/**
 * calculate and return md5 version of all input files
 * copy input files to the versioned files, eg, `foo.js` -> `foo-cb6143ff70a133027139bbf27746a3c4.js`
 * you can change the rule of generating new file names, by the optional `customNewFileName` in `options` parameter
 * return key of the return object, is camelcased file name, eg, `foo/bar.js` -> `fooBarJs`
 * `inputFiles` support glob
 */
export function revisionCssJs(inputFiles: string[], options?: Options) {
    const variables = ((options && options.shaType) ? { sri: {} } : {}) as { sri: { [name: string]: string } } & { [name: string]: string };
    for (const filePath of inputFiles) {
        const variableName = getVariableName(filePath);
        const fileString = fs.readFileSync(filePath).toString();
        const newFileName = getNewFileName(fileString, filePath, options ? options.customNewFileName : undefined);
        if (!options || !options.noOutputFiles || options.noOutputFiles.indexOf(filePath) === -1) {
            fs.createReadStream(filePath).pipe(fs.createWriteStream(path.resolve(path.dirname(filePath), newFileName)));
        }
        variables[variableName] = newFileName;
        if (options && options.shaType) {
            variables.sri[variableName] = `sha${options.shaType}-` + calculateSha(fileString, options.shaType);
        }
    }
    return variables;
}

/**
 * generate html files just as the `outputFiles` shows
 * the `inputFiles` should be `ejs` templates, the variables will be `versions` from `revisionCssJs` function
 * the `inputFiles` and `outputFiles` should be one-to-one map, eg, input `["foo.ejs.html", "bar.ejs.html"]` and output `["foo.html", "bar.html"]`
 * the `ejsOptions` in `options` will be transfered to ejs
 */
export async function revisionHtml(htmlInputFiles: string[], htmlOutputFiles: string[], newFileNames: { [name: string]: string }, options?: { ejsOptions?: ejs.Options, customNewFileName?: CustomNewFileName }) {
    const ejsOptions = options && options.ejsOptions ? options.ejsOptions : {};
    for (let i = 0; i < htmlInputFiles.length; i++) {
        const fileString = await renderEjsAsync(htmlInputFiles[i], newFileNames, ejsOptions);
        await writeFileAsync(htmlOutputFiles[i], fileString);
        console.log(`Success: to "${htmlOutputFiles[i]}" from "${htmlInputFiles[i]}".`);

        const variableName = getVariableName(htmlOutputFiles[i]);
        const newFileName = getNewFileName(fileString, htmlOutputFiles[i], options ? options.customNewFileName : undefined);
        newFileNames[variableName] = newFileName;
    }
}

export function executeCommandLine() {
    const argv = minimist(process.argv.slice(2), {
        "--": true,
    });

    const showHelp = argv.h || argv.help;
    if (showHelp) {
        showHelpInformation();
        return;
    }

    const showVersion = argv.v || argv.version;
    if (showVersion) {
        showToolVersion();
        return;
    }

    const inputFiles = argv._;
    if (inputFiles.some(f => f === "init")) {
        writeFileAsync(defaultConfigName, defaultConfigContent).then(() => {
            console.log(`Success: to "${defaultConfigName}".`);
        }, error => {
            console.log(error);
        });
        return;
    }

    let config: string | undefined = argv.config;
    if (!config) {
        config = defaultConfigName;
    }
    const configPath = path.resolve(process.cwd(), config);

    let configData: {
        inputFiles: string[];
        outputFiles: string[] | ((file: string) => string);
        json?: boolean | string;
        ejsOptions?: ejs.Options;
        sha?: 256 | 384 | 512;
        customNewFileName?: CustomNewFileName;
        noOutputFiles?: string[];
        es6?: boolean | string;
        less?: boolean | string;
        scss?: boolean | string;
    };
    try {
        configData = require(configPath);
        if (configData && configData.noOutputFiles && configData.inputFiles) {
            configData.inputFiles.push(...configData.noOutputFiles);
        }
    } catch (error) {
        console.log(error);
        const outFilesString: string = argv.o || argv.out;
        if (typeof outFilesString !== "string") {
            console.log(`Error: invalid parameter: "-o".`);
            showHelpInformation();
            return;
        }
        const shaType: 256 | 384 | 512 | undefined = argv.sha;
        if (shaType && [256, 384, 512].indexOf(shaType) === -1) {
            console.log("Error: invalid parameter `sha`.");
            showHelpInformation();
            return;
        }
        configData = {
            inputFiles,
            outputFiles: outFilesString.split(","),
            json: argv.j || argv.json,
            sha: shaType,
            es6: argv.e || argv.es6,
            less: argv.l || argv.less,
            scss: argv.s || argv.scss,
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

    Promise.all(configData.inputFiles.map(file => globAsync(file))).then(files => {
        const uniqFiles = uniq(flatten(files));

        for (const file of uniqFiles) {
            if (!fs.existsSync(file)) {
                console.log(`Error: file: "${file}" not exists.`);
                showHelpInformation();
                return;
            }
            const extensionName = path.extname(file);
            if (htmlExtensions.indexOf(extensionName.toLowerCase()) !== -1) {
                htmlInputFiles.push(file);
            } else {
                jsCssInputFiles.push(file);
            }
        }

        let htmlOutputFiles: string[];
        if (typeof configData.outputFiles === "function") {
            htmlOutputFiles = htmlInputFiles.map(file => (configData.outputFiles as (file: string) => string)(file));
        } else {
            if (configData.outputFiles.length !== htmlInputFiles.length) {
                console.log(`Error: input ${htmlInputFiles.length} html files, but output ${configData.outputFiles.length} html files.`);
                showHelpInformation();
                return;
            }
            htmlOutputFiles = configData.outputFiles;
        }

        const newFileNames = revisionCssJs(jsCssInputFiles, {
            shaType: configData.sha,
            customNewFileName: configData.customNewFileName,
            noOutputFiles: configData.noOutputFiles,
        });

        revisionHtml(htmlInputFiles, htmlOutputFiles, newFileNames, { ejsOptions: configData.ejsOptions, customNewFileName: configData.customNewFileName }).then(() => {
            console.log(`New File Names: ${JSON.stringify(newFileNames, null, "  ")}`);

            if (configData.json === true) {
                console.log(`Warn: expect path of json file.`);
            } else if (typeof configData.json === "string") {
                writeFileAsync(configData.json, JSON.stringify(newFileNames, null, "  ")).then(() => {
                    console.log(`Success: to "${configData.json}".`);
                }, error => {
                    console.log(error);
                });
            }

            if (configData.es6 === true) {
                console.log(`Warn: expect path of es6 file.`);
            } else if (typeof configData.es6 === "string") {
                const variables: string[] = [];
                for (const key in newFileNames) {
                    if (key !== "sri") {
                        variables.push(`export const ${key} = "${newFileNames[key]}";\n`);
                    }
                }

                writeFileAsync(configData.es6, variables.join("")).then(() => {
                    console.log(`Success: to "${configData.es6}".`);
                }, error => {
                    console.log(error);
                });
            }

            if (configData.less === true) {
                console.log(`Warn: expect path of less file.`);
            } else if (typeof configData.less === "string") {
                const variables: string[] = [];
                for (const key in newFileNames) {
                    if (key !== "sri") {
                        variables.push(`@${key}: '${newFileNames[key]}';\n`);
                    }
                }

                writeFileAsync(configData.less, variables.join("")).then(() => {
                    console.log(`Success: to "${configData.less}".`);
                }, error => {
                    console.log(error);
                });
            }

            if (configData.scss === true) {
                console.log(`Warn: expect path of scss file.`);
            } else if (typeof configData.scss === "string") {
                const variables: string[] = [];
                for (const key in newFileNames) {
                    if (key !== "sri") {
                        variables.push(`$${key}: '${newFileNames[key]}';\n`);
                    }
                }

                writeFileAsync(configData.scss, variables.join("")).then(() => {
                    console.log(`Success: to "${configData.scss}".`);
                }, error => {
                    console.log(error);
                });
            }
        });
    }, (error: Error) => {
        console.log(error);
        showHelpInformation();
    });
}
