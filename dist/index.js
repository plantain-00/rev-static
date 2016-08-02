"use strict";
var ejs = require("ejs");
var fs = require("fs");
var crypto = require("crypto");
var minimist = require("minimist");
var camelcase = require("camelcase");
var path = require("path");
var glob = require("glob");
var Promise = require("bluebird");
var packageJson = require("../package.json");
var flatten = require("lodash.flatten");
var uniq = require("lodash.uniq");
function md5(str) {
    return crypto.createHash("md5").update(str).digest("hex");
}
function calculateSha(str, shaType) {
    return crypto.createHash("sha256").update(str).digest("base64");
}
function showToolVersion() {
    console.log("Version: " + packageJson.version);
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
    console.log("  --sha [type]         calculate sha of files, type can be `256`, `384` or `512`.");
}
function globAsync(pattern) {
    return new Promise(function (resolve, reject) {
        glob(pattern, function (error, matches) {
            if (error) {
                reject(error);
            }
            else {
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
function revisionCssJs(inputFiles, options) {
    var variables = ((options && options.shaType) ? { sri: {} } : {});
    var delimiter = options && options.delimiter ? options.delimiter : "-";
    return Promise.all(inputFiles.map(function (f) { return globAsync(f); })).then(function (files) {
        var allFiles = uniq(flatten(files));
        for (var _i = 0, allFiles_1 = allFiles; _i < allFiles_1.length; _i++) {
            var filePath = allFiles_1[_i];
            var variableName = camelcase(path.normalize(filePath).replace(/\\|\//g, "-"));
            var fileString = fs.readFileSync(filePath).toString();
            var md5String = md5(fileString);
            var newFileName = void 0;
            var extensionName = path.extname(filePath);
            var baseName = path.basename(filePath, extensionName);
            if (options && options.customNewFileName) {
                newFileName = options.customNewFileName(filePath, fileString, md5String, baseName, extensionName);
            }
            else {
                newFileName = baseName + delimiter + md5String + extensionName;
            }
            fs.createReadStream(filePath).pipe(fs.createWriteStream(path.resolve(path.dirname(filePath), newFileName)));
            variables[variableName] = newFileName;
            if (options && options.shaType) {
                variables.sri[variableName] = ("sha" + options.shaType + "-") + calculateSha(fileString, options.shaType);
            }
        }
        return variables;
    });
}
exports.revisionCssJs = revisionCssJs;
function getOutputFiles(inputFiles, outputFiles) {
    if (typeof outputFiles === "function") {
        return Promise.all(inputFiles.map(function (f) { return globAsync(f); })).then(function (files) { return uniq(flatten(files)).map(function (f) { return outputFiles(f); }); });
    }
    else {
        if (outputFiles.length !== inputFiles.length) {
            return Promise.reject("Error: input " + inputFiles.length + " html files, but output " + outputFiles.length + " html files.");
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
function revisionHtml(inputFiles, outputFiles, newFileNames, options) {
    getOutputFiles(inputFiles, outputFiles).then(function (finalOutputFiles) {
        var ejsOptions = options && options.ejsOptions ? options.ejsOptions : {};
        var _loop_1 = function(i) {
            ejs.renderFile(inputFiles[i], newFileNames, ejsOptions, function (renderError, file) {
                if (renderError) {
                    console.log(renderError);
                }
                else {
                    fs.writeFile(finalOutputFiles[i], file, function (writeError) {
                        if (writeError) {
                            console.log(writeError);
                        }
                        else {
                            console.log("Success: to \"" + finalOutputFiles[i] + "\" from \"" + inputFiles[i] + "\".");
                        }
                    });
                }
            });
        };
        for (var i = 0; i < inputFiles.length; i++) {
            _loop_1(i);
        }
    }, function (error) {
        console.log(error);
        showHelpInformation();
    });
}
exports.revisionHtml = revisionHtml;
function executeCommandLine() {
    var argv = minimist(process.argv.slice(2), {
        "--": true,
    });
    var ejsOptions;
    if (argv["--"]) {
        var ejsArgv = minimist(argv["--"]);
        delete ejsArgv._;
        ejsOptions = ejsArgv;
    }
    else {
        ejsOptions = {};
    }
    var showHelp = argv["h"] || argv["help"];
    if (showHelp) {
        showHelpInformation();
        return;
    }
    var showVersion = argv["v"] || argv["version"];
    if (showVersion) {
        showToolVersion();
        return;
    }
    var inputFiles = argv["_"];
    if (!inputFiles || inputFiles.length === 0) {
        console.log("Error: no input files.");
        showHelpInformation();
        return;
    }
    var shaType = argv["sha"];
    if (shaType) {
        if ([256, 384, 512].indexOf(shaType) === -1) {
            console.log("Error: invalid parameter `sha`.");
            showHelpInformation();
            return;
        }
    }
    var htmlInputFiles = [];
    var jsCssInputFiles = [];
    for (var _i = 0, inputFiles_1 = inputFiles; _i < inputFiles_1.length; _i++) {
        var file = inputFiles_1[_i];
        if (!fs.existsSync(file)) {
            console.log("Error: file: \"" + file + "\" not exists.");
            showHelpInformation();
            return;
        }
        var extensionName = path.extname(file);
        if ([".html", ".htm", "ejs"].indexOf(extensionName.toLowerCase()) !== -1) {
            htmlInputFiles.push(file);
        }
        else {
            jsCssInputFiles.push(file);
        }
    }
    revisionCssJs(jsCssInputFiles, { shaType: shaType }).then(function (newFileNames) {
        console.log("New File Names: " + JSON.stringify(newFileNames, null, "  "));
        var json = argv["j"] || argv["json"];
        if (json === true) {
            console.log("Warn: expect path of json file.");
        }
        else if (typeof json === "string") {
            fs.writeFile(json, JSON.stringify(newFileNames, null, "  "), function (error) {
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
            showHelpInformation();
            return;
        }
        var htmlOutputFiles = outFilesString.split(",");
        revisionHtml(htmlInputFiles, htmlOutputFiles, newFileNames, { ejsOptions: ejsOptions });
    }, function (error) {
        console.log(error);
        showHelpInformation();
    });
}
exports.executeCommandLine = executeCommandLine;
//# sourceMappingURL=index.js.map