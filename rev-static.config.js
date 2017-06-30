module.exports = [
  {
    inputFiles: [
      'demo/*.js',
      'demo/*.css',
      'demo/*.png',
      'demo/*.ejs.html'
    ],
    excludeFiles: [
      'demo/*-*.*'
    ],
    outputFiles: file => file.replace('.ejs', ''),
    json: 'demo/variables.json',
    ejsOptions: {
      rmWhitespace: true
    },
    sha: 256,
    customNewFileName: (filePath, fileString, md5String, baseName, extensionName) => baseName + '-' + md5String + extensionName,
    noOutputFiles: [
      'demo/worker.js'
    ],
    es6: 'demo/variables.ts',
    less: 'demo/variables.less',
    scss: 'demo/variables.scss'
  }
]
