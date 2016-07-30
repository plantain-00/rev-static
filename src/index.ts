import * as ejs from "ejs";
import * as fs from "fs";
import * as crypto from "crypto";
import * as minimist from "minimist";
import * as camelcase from "camelcase";
import * as path from "path";

function md5(str: string): string {
    return crypto.createHash("md5").update(str).digest("hex");
}

function showHelpInformation(code: number) {
    console.log("Syntax:          rev-static [options] [file ...]");
    console.log("Examples:");
    console.log("  %> rev-static foo.js bar.ejs.html -o bar.html");
    console.log("  %> rev-static foo.js bar.css baz.ejs.html -o baz.html");
    console.log("  %> rev-static foo.js bar.css baz.ejs.html qux.ejs.html -o baz.html,qux.html");
    console.log("Options:");
    console.log("  -o, --out      output html files, seperated by ',' if there are more than 1 file.");
    console.log("  -h, --help     print this message.");
    console.log("  -j, --json     show the variables as json format, or output as json file.");
    console.log("");
    process.exit(code);
}

/**
 * calculate and return md5 version of all input files
 * copy input files to the versioned files, eg, `foo.js` -> `foo-cb6143ff70a133027139bbf27746a3c4.js`
 * return key of the return object, is camelcased file name, eg, `foo/bar.js` -> `fooBarJs`
 */
export function revisionCssJs(inputFiles: string[]) {
    const variables: { [name: string]: string } = {};
    for (const file of inputFiles) {
        const variableName = camelcase(path.normalize(file).replace(/\\|\//g, "-"));
        const version = md5(fs.readFileSync(file).toString());
        const extensionName = path.extname(file);
        const newPath = path.resolve(path.dirname(file), path.basename(file, extensionName) + "-" + version + extensionName);
        fs.createReadStream(file).pipe(fs.createWriteStream(newPath));
        variables[variableName] = version;
    }
    return variables;
}

/**
 * generate html files just as the `outputFiles` shows
 * the `inputFiles` should be `ejs` templates, the variables will be `versions` from `revisionCssJs` function
 * the `inputFiles` and `outputFiles` should be one-to-one map, eg, input `["foo.ejs.html", "bar.ejs.html"]` and output `["foo.html", "bar.html"]`
 */
export function revisionHtml(inputFiles: string[], outputFiles: string[], versions: { [name: string]: string }) {
    if (outputFiles.length !== inputFiles.length) {
        console.log(`Error: input ${inputFiles.length} html files, but output ${outputFiles.length} html files.`);
        showHelpInformation(1);
    }
    for (let i = 0; i < inputFiles.length; i++) {
        ejs.renderFile(inputFiles[i], versions, {}, (renderError: Error, file: any) => {
            if (renderError) {
                console.log(renderError);
            } else {
                fs.writeFile(outputFiles[i], file, writeError => {
                    if (writeError) {
                        console.log(writeError);
                    } else {
                        console.log(`Success: to "${outputFiles[i]}" from "${inputFiles[i]}".`);
                    }
                });
            }
        });
    }
}

export function executeCommandLine() {
    const argv = minimist(process.argv.slice(2));
    const showHelp = argv["h"] || argv["help"];
    if (showHelp) {
        showHelpInformation(0);
    }
    const inputFiles = argv["_"];
    if (!inputFiles || inputFiles.length === 0) {
        console.log("Error: no input files.");
        showHelpInformation(1);
    }
    const htmlInputFiles: string[] = [];
    const jsCssInputFiles: string[] = [];
    for (const file of inputFiles) {
        if (!fs.existsSync(file)) {
            console.log(`Error: file: "${file}" not exists.`);
            showHelpInformation(1);
        }
        const extensionName = path.extname(file);
        if (extensionName.toLowerCase() === ".html") {
            htmlInputFiles.push(file);
        } else {
            jsCssInputFiles.push(file);
        }
    }
    const versions = revisionCssJs(jsCssInputFiles);
    const json: boolean | string = argv["j"] || argv["json"];
    if (json === true) {
        console.log(`Versions: \n${JSON.stringify(versions, null, "  ")}`);
    } else if (typeof json === "string") {
        fs.writeFile(json, JSON.stringify(versions, null, "  "), error => {
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
        showHelpInformation(1);
    }
    const htmlOutputFiles = outFilesString.split(",");
    revisionHtml(htmlInputFiles, htmlOutputFiles, versions);
}
