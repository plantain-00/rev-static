"use strict";
var ejs = require("ejs");
var fs = require("fs");
var crypto = require("crypto");
var minimist = require("minimist");
var camelcase = require("camelcase");
var path = require("path");
var packageJson = require("../package.json");
function md5(str) {
    return crypto.createHash("md5").update(str).digest("hex");
}
function showToolVersion() {
    console.log("Version: " + packageJson.version);
}
function showHelpInformation(code) {
    showToolVersion();
    console.log("Syntax:          rev-static [options] [file ...]");
    console.log("Examples:");
    console.log("  %> rev-static foo.js bar.ejs.html -o bar.html");
    console.log("  %> rev-static foo.js bar.css baz.ejs.html -o baz.html");
    console.log("  %> rev-static foo.js bar.css baz.ejs.html qux.ejs.html -o baz.html,qux.html");
    console.log("  %> rev-static foo.js bar.css -j version.json");
    console.log("Options:");
    console.log("  -o, --out      output html files, seperated by ',' if there are more than 1 file.");
    console.log("  -h, --help     print this message.");
    console.log("  -j, --json     output the variables in a json file, can be used by back-end templates.");
    console.log("  -v, --version  print the tool's version.");
    console.log("");
    process.exit(code);
}
/**
 * calculate and return md5 version of all input files
 * copy input files to the versioned files, eg, `foo.js` -> `foo-cb6143ff70a133027139bbf27746a3c4.js`
 * return key of the return object, is camelcased file name, eg, `foo/bar.js` -> `fooBarJs`
 */
function revisionCssJs(inputFiles) {
    var variables = {};
    for (var _i = 0, inputFiles_1 = inputFiles; _i < inputFiles_1.length; _i++) {
        var file = inputFiles_1[_i];
        var variableName = camelcase(path.normalize(file).replace(/\\|\//g, "-"));
        var fileVersion = md5(fs.readFileSync(file).toString());
        var extensionName = path.extname(file);
        var newPath = path.resolve(path.dirname(file), path.basename(file, extensionName) + "-" + fileVersion + extensionName);
        fs.createReadStream(file).pipe(fs.createWriteStream(newPath));
        variables[variableName] = fileVersion;
    }
    return variables;
}
exports.revisionCssJs = revisionCssJs;
/**
 * generate html files just as the `outputFiles` shows
 * the `inputFiles` should be `ejs` templates, the variables will be `versions` from `revisionCssJs` function
 * the `inputFiles` and `outputFiles` should be one-to-one map, eg, input `["foo.ejs.html", "bar.ejs.html"]` and output `["foo.html", "bar.html"]`
 */
function revisionHtml(inputFiles, outputFiles, versions) {
    if (outputFiles.length !== inputFiles.length) {
        console.log("Error: input " + inputFiles.length + " html files, but output " + outputFiles.length + " html files.");
        showHelpInformation(1);
    }
    var _loop_1 = function(i) {
        ejs.renderFile(inputFiles[i], versions, {}, function (renderError, file) {
            if (renderError) {
                console.log(renderError);
            }
            else {
                fs.writeFile(outputFiles[i], file, function (writeError) {
                    if (writeError) {
                        console.log(writeError);
                    }
                    else {
                        console.log("Success: to \"" + outputFiles[i] + "\" from \"" + inputFiles[i] + "\".");
                    }
                });
            }
        });
    };
    for (var i = 0; i < inputFiles.length; i++) {
        _loop_1(i);
    }
}
exports.revisionHtml = revisionHtml;
function executeCommandLine() {
    var argv = minimist(process.argv.slice(2));
    var showHelp = argv["h"] || argv["help"];
    if (showHelp) {
        showHelpInformation(0);
    }
    var showVersion = argv["v"] || argv["version"];
    if (showVersion) {
        showToolVersion();
        process.exit(0);
    }
    var inputFiles = argv["_"];
    if (!inputFiles || inputFiles.length === 0) {
        console.log("Error: no input files.");
        showHelpInformation(1);
    }
    var htmlInputFiles = [];
    var jsCssInputFiles = [];
    for (var _i = 0, inputFiles_2 = inputFiles; _i < inputFiles_2.length; _i++) {
        var file = inputFiles_2[_i];
        if (!fs.existsSync(file)) {
            console.log("Error: file: \"" + file + "\" not exists.");
            showHelpInformation(1);
        }
        var extensionName = path.extname(file);
        if ([".html", ".htm", "ejs"].indexOf(extensionName.toLowerCase()) !== -1) {
            htmlInputFiles.push(file);
        }
        else {
            jsCssInputFiles.push(file);
        }
    }
    var versions = revisionCssJs(jsCssInputFiles);
    console.log("Versions: \n" + JSON.stringify(versions, null, "  "));
    var json = argv["j"] || argv["json"];
    if (json === true) {
        console.log("Warn: expect path of json file.");
    }
    else if (typeof json === "string") {
        fs.writeFile(json, JSON.stringify(versions, null, "  "), function (error) {
            if (error) {
                console.log(error);
            }
            else {
                console.log("Success: to \"" + json + "\".");
            }
        });
    }
    var outFilesString = argv["o"] || argv["out"];
    if (typeof outFilesString !== "string") {
        console.log("Error: invalid parameter: \"-o\".");
        showHelpInformation(1);
    }
    var htmlOutputFiles = outFilesString.split(",");
    revisionHtml(htmlInputFiles, htmlOutputFiles, versions);
}
exports.executeCommandLine = executeCommandLine;
//# sourceMappingURL=index.js.map