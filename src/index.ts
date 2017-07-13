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
import * as gzipSize from "gzip-size";
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

type CustomNewFileName = (filePath: string, fileString: string, md5String: string, baseName: string, extensionName: string) => string;

type CustomOldFileName = (filePath: string, baseName: string, extensionName: string) => string;

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
    const dirname = path.dirname(filePath);
    if (customOldFileName) {
        return path.relative(".", path.resolve(dirname, customOldFileName(filePath, baseName, extensionName)));
    } else {
        return path.relative(".", path.resolve(dirname, baseName.split("-")[0] + extensionName));
    }
}

function revisionCssJs(inputFiles: string[], configData: ConfigData) {
    const variables: { [name: string]: string } = {};
    const sriVariables: { [name: string]: string } = {};
    const fileSizes: { [name: string]: string } = {};
    const inlineVariables: { [name: string]: string } = {};
    for (const filePath of inputFiles) {
        const fileString = fs.readFileSync(filePath).toString();
        let variableName: string;
        let newFileName: string | undefined;
        const isInlined = configData.inlinedFiles && configData.inlinedFiles.some(inlinedFile => minimatch(filePath, inlinedFile));
        if (configData.revisedFiles
            && configData.revisedFiles.length > 0
            && configData.revisedFiles.some(revisedFile => minimatch(filePath, revisedFile))) {
            const oldFileName = getOldFileName(filePath, configData.customOldFileName);
            variableName = getVariableName(configData.base ? path.relative(configData.base, oldFileName) : oldFileName);
            if (!isInlined) {
                newFileName = path.basename(filePath);
            }
        } else {
            variableName = getVariableName(configData.base ? path.relative(configData.base, filePath) : filePath);
            if (!isInlined) {
                newFileName = getNewFileName(fileString, filePath, configData.customNewFileName);
                fs.createReadStream(filePath).pipe(fs.createWriteStream(path.resolve(path.dirname(filePath), newFileName)));
            }
        }
        fileSizes[variableName] = prettyBytes(fileString.length) + " " + prettyBytes(gzipSize.sync(fileString));
        if (newFileName) {
            variables[variableName] = newFileName;
        }
        if (configData.sha) {
            sriVariables[variableName] = `sha${configData.sha}-` + calculateSha(fileString, configData.sha);
        }
        if (isInlined) {
            if (filePath.endsWith(".js")) {
                inlineVariables[variableName] = `<script>\n${fileString}\n</script>\n`;
            } else if (filePath.endsWith(".css")) {
                inlineVariables[variableName] = `<style>\n${fileString}\n</style>\n`;
            }
        }
    }
    return { variables, sriVariables, fileSizes, inlineVariables };
}

async function revisionHtml(htmlInputFiles: string[], htmlOutputFiles: string[], newFileNames: { [name: string]: any }, configData: ConfigData, fileSizes: { [name: string]: string }) {
    const ejsOptions = configData.ejsOptions ? configData.ejsOptions : {};
    for (let i = 0; i < htmlInputFiles.length; i++) {
        const fileString = await renderEjsAsync(htmlInputFiles[i], newFileNames, ejsOptions);
        await writeFileAsync(htmlOutputFiles[i], fileString);
        print(`Success: to "${htmlOutputFiles[i]}" from "${htmlInputFiles[i]}".`);

        const variableName = getVariableName(htmlOutputFiles[i]);
        fileSizes[variableName] = prettyBytes(fileString.length) + " " + prettyBytes(gzipSize.sync(fileString));
    }
}

function isImage(key: string) {
    return key !== "sri" && key !== "inline" && !key.endsWith("Js") && !key.endsWith("Html") && !key.endsWith("Css");
}

export async function executeCommandLine() {
    try {
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

        const configFileData: ConfigData | ConfigData[] = require(configPath);
        const configDatas = Array.isArray(configFileData) ? configFileData : [configFileData];

        for (const configData of configDatas) {
            if (!configData.inputFiles || configData.inputFiles.length === 0) {
                throw new Error("Error: no input files.");
            }

            const htmlInputFiles: string[] = [];
            const jsCssInputFiles: string[] = [];

            const files = await Promise.all(configData.inputFiles.map(file => globAsync(file)));
            let uniqFiles = uniq(flatten(files));
            if (configData.excludeFiles) {
                uniqFiles = uniqFiles.filter(file => configData.excludeFiles && configData.excludeFiles.every(excludeFile => !minimatch(file, excludeFile)));
            }

            for (const file of uniqFiles) {
                if (!fs.existsSync(file)) {
                    throw new Error(`Error: file: "${file}" not exists.`);
                }
                const extensionName = path.extname(file);
                if (htmlExtensions.indexOf(extensionName.toLowerCase()) !== -1) {
                    htmlInputFiles.push(file);
                } else {
                    jsCssInputFiles.push(file);
                }
            }

            const htmlOutputFiles = htmlInputFiles.map(file => configData.outputFiles(file));

            const { variables: newFileNames, sriVariables, fileSizes, inlineVariables } = revisionCssJs(jsCssInputFiles, configData);
            print(`New File Names: ${JSON.stringify(newFileNames, null, "  ")}`);
            // tslint:disable-next-line:prefer-object-spread
            await revisionHtml(htmlInputFiles, htmlOutputFiles, Object.assign({ inline: inlineVariables }, { sri: sriVariables }, newFileNames), configData, fileSizes);

            if (configData.json) {
                await writeFileAsync(configData.json, JSON.stringify(newFileNames, null, "  "));
                print(`Success: to "${configData.json}".`);
            }

            if (configData.es6) {
                const variables: string[] = [];
                for (const key in newFileNames) {
                    if (isImage(key)) {
                        variables.push(`export const ${key} = "${newFileNames[key]}";\n`);
                    }
                }

                await writeFileAsync(configData.es6, variables.join(""));
                print(`Success: to "${configData.es6}".`);
            }

            if (configData.less) {
                const variables: string[] = [];
                for (const key in newFileNames) {
                    if (isImage(key)) {
                        variables.push(`@${key}: '${newFileNames[key]}';\n`);
                    }
                }

                await writeFileAsync(configData.less, variables.join(""));
                print(`Success: to "${configData.less}".`);
            }

            if (configData.scss) {
                const variables: string[] = [];
                for (const key in newFileNames) {
                    if (isImage(key)) {
                        variables.push(`$${key}: '${newFileNames[key]}';\n`);
                    }
                }

                await writeFileAsync(configData.scss, variables.join(""));
                print(`Success: to "${configData.scss}".`);
            }

            if (configData.fileSize) {
                await writeFileAsync(configData.fileSize, JSON.stringify(fileSizes, null, "  "));
                print(`Success: to "${configData.fileSize}".`);
            }
        }
    } catch (error) {
        print(error);
        process.exit(1);
    }
}

type ConfigData = {
    inputFiles: string[];
    excludeFiles?: string[];
    revisedFiles?: string[];
    inlinedFiles?: string[];
    outputFiles: ((file: string) => string);
    json?: string;
    ejsOptions?: ejs.Options;
    sha?: 256 | 384 | 512;
    customNewFileName?: CustomNewFileName;
    customOldFileName?: CustomOldFileName;
    es6?: string;
    less?: string;
    scss?: string;
    base?: string;
    fileSize?: string;
};
