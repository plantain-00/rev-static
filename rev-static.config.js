module.exports = {
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
