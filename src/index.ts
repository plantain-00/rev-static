import * as ejs from "ejs";
import * as fs from "fs";
import * as crypto from "crypto";
import * as minimist from "minimist";
import * as camelcase from "camelcase";
import * as path from "path";
import * as glob from "glob";
import * as flatten from "lodash.flatten";
import * as uniq from "lodash.uniq";
import * as prettyBytes from "pretty-bytes";
import * as minimatch from "minimatch";
import * as packageJson from "../package.json";

function md5(str: string): string {
    return crypto.createHash("md5").update(str).digest("hex");
}

function calculateSha(str: string, shaType: 256 | 384 | 512): string {
    return crypto.createHash(`sha${shaType}`).update(str).digest("base64");
}

function print(message: any) {
    // tslint:disable-next-line:no-console
    console.log(message);
}

function showToolVersion() {
    print(`Version: ${packageJson.version}`);
}

const defaultConfigName = "rev-static.config.js";

const htmlExtensions = [".html", ".htm", ".ejs"];

function globAsync(pattern: string, ignore: string[]) {
    return new Promise<string[]>((resolve, reject) => {
        glob(pattern, { ignore }, (error, matches) => {
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

export type CustomOldFileName = (filePath: string, baseName: string, extensionName: string) => string;

export type Options = {
    customNewFileName?: CustomNewFileName;
    customOldFileName?: CustomOldFileName;
    shaType?: 256 | 384 | 512 | undefined;
    base?: string;
    revisedFiles?: string[];
};

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

function getOldFileName(filePath: string, customOldFileName?: CustomOldFileName) {
    const extensionName = path.extname(filePath);
    const baseName = path.basename(filePath, extensionName);
    if (customOldFileName) {
        return customOldFileName(filePath, baseName, extensionName);
    } else {
        return baseName.split("-")[0] + extensionName;
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
    const fileSizes: { [name: string]: string } = {};
    for (const filePath of inputFiles) {
        const fileString = fs.readFileSync(filePath).toString();
        let variableName: string;
        let newFileName: string;
        if (options
            && options.revisedFiles
            && options.revisedFiles.length > 0
            && options.revisedFiles.some(revisedFile => minimatch(filePath, revisedFile))) {
            const oldFileName = getOldFileName(filePath, options.customOldFileName);
            variableName = getVariableName(options.base ? path.relative(options.base, oldFileName) : oldFileName);
            newFileName = options.base ? path.relative(options.base, filePath) : filePath;
        } else {
            variableName = getVariableName((options && options.base) ? path.relative(options.base, filePath) : filePath);
            fileSizes[variableName] = prettyBytes(fileString.length);
            newFileName = getNewFileName(fileString, filePath, options ? options.customNewFileName : undefined);
            fs.createReadStream(filePath).pipe(fs.createWriteStream(path.resolve(path.dirname(filePath), newFileName)));
        }
        variables[variableName] = newFileName;
        if (options && options.shaType) {
            variables.sri[variableName] = `sha${options.shaType}-` + calculateSha(fileString, options.shaType);
        }
    }
    return { variables, fileSizes };
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
        print(`Success: to "${htmlOutputFiles[i]}" from "${htmlInputFiles[i]}".`);

        const variableName = getVariableName(htmlOutputFiles[i]);
        const newFileName = getNewFileName(fileString, htmlOutputFiles[i], options ? options.customNewFileName : undefined);
        newFileNames[variableName] = newFileName;
    }
}

function isImage(key: string) {
    return key !== "sri" && !key.endsWith("Js") && !key.endsWith("Html") && !key.endsWith("Css");
}

export function executeCommandLine() {
    const argv = minimist(process.argv.slice(2), { "--": true });

    const showVersion = argv.v || argv.version;
    if (showVersion) {
        showToolVersion();
        return;
    }

    let config: string | undefined = argv.config;
    if (!config) {
        config = defaultConfigName;
    }
    const configPath = path.resolve(process.cwd(), config);

    let configDatas: ConfigData[];
    try {
        const configData: ConfigData | ConfigData[] = require(configPath);
        configDatas = Array.isArray(configData) ? configData : [configData];
    } catch (error) {
        print(error);
        return;
    }

    for (const configData of configDatas) {
        if (!configData.inputFiles || configData.inputFiles.length === 0) {
            print("Error: no input files.");
            return;
        }

        const htmlInputFiles: string[] = [];
        const jsCssInputFiles: string[] = [];

        Promise.all(configData.inputFiles.map(file => globAsync(file, configData.excludeFiles))).then(files => {
            const uniqFiles = uniq(flatten(files));

            for (const file of uniqFiles) {
                if (!fs.existsSync(file)) {
                    print(`Error: file: "${file}" not exists.`);
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
                    print(`Error: input ${htmlInputFiles.length} html files, but output ${configData.outputFiles.length} html files.`);
                    return;
                }
                htmlOutputFiles = configData.outputFiles;
            }

            const { variables: newFileNames, fileSizes } = revisionCssJs(jsCssInputFiles, {
                shaType: configData.sha,
                customNewFileName: configData.customNewFileName,
                customOldFileName: configData.customOldFileName,
                base: configData.base,
                revisedFiles: configData.revisedFiles,
            });
            print(`New File Names: ${JSON.stringify(newFileNames, null, "  ")}`);

            revisionHtml(htmlInputFiles, htmlOutputFiles, newFileNames, { ejsOptions: configData.ejsOptions, customNewFileName: configData.customNewFileName }).then(() => {
                if (configData.json === true) {
                    print(`Warn: expect path of json file.`);
                } else if (typeof configData.json === "string") {
                    writeFileAsync(configData.json, JSON.stringify(newFileNames, null, "  ")).then(() => {
                        print(`Success: to "${configData.json}".`);
                    }, error => {
                        print(error);
                    });
                }

                if (configData.es6 === true) {
                    print(`Warn: expect path of es6 file.`);
                } else if (typeof configData.es6 === "string") {
                    const variables: string[] = [];
                    for (const key in newFileNames) {
                        if (isImage(key)) {
                            variables.push(`export const ${key} = "${newFileNames[key]}";\n`);
                        }
                    }

                    writeFileAsync(configData.es6, variables.join("")).then(() => {
                        print(`Success: to "${configData.es6}".`);
                    }, error => {
                        print(error);
                    });
                }

                if (configData.less === true) {
                    print(`Warn: expect path of less file.`);
                } else if (typeof configData.less === "string") {
                    const variables: string[] = [];
                    for (const key in newFileNames) {
                        if (isImage(key)) {
                            variables.push(`@${key}: '${newFileNames[key]}';\n`);
                        }
                    }

                    writeFileAsync(configData.less, variables.join("")).then(() => {
                        print(`Success: to "${configData.less}".`);
                    }, error => {
                        print(error);
                    });
                }

                if (configData.scss === true) {
                    print(`Warn: expect path of scss file.`);
                } else if (typeof configData.scss === "string") {
                    const variables: string[] = [];
                    for (const key in newFileNames) {
                        if (isImage(key)) {
                            variables.push(`$${key}: '${newFileNames[key]}';\n`);
                        }
                    }

                    writeFileAsync(configData.scss, variables.join("")).then(() => {
                        print(`Success: to "${configData.scss}".`);
                    }, error => {
                        print(error);
                    });
                }

                if (configData.fileSize && typeof configData.fileSize === "string") {
                    writeFileAsync(configData.fileSize, JSON.stringify(fileSizes, null, "  ")).then(() => {
                        print(`Success: to "${configData.fileSize}".`);
                    }, error => {
                        print(error);
                    });
                }
            });
        }, (error: Error) => {
            print(error);
        });
    }
}

type ConfigData = {
    inputFiles: string[];
    excludeFiles: string[];
    revisedFiles?: string[];
    outputFiles: string[] | ((file: string) => string);
    json?: boolean | string;
    ejsOptions?: ejs.Options;
    sha?: 256 | 384 | 512;
    customNewFileName?: CustomNewFileName;
    customOldFileName?: CustomOldFileName;
    es6?: boolean | string;
    less?: boolean | string;
    scss?: boolean | string;
    base?: string;
    fileSize?: string;
};
