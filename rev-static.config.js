module.exports = [
  {
    inputFiles: [
      'demo/*.js',
      'demo/*.css',
      'demo/*.png',
      'demo/*.ejs.html'
    ],
    excludeFiles: [
      'demo/movie.css'
    ],
    revisedFiles: [
      'demo/movie-*.js'
    ],
    inlinedFiles: [
      'demo/shop.js',
      'demo/shop.css'
    ],
    outputFiles: file => file.replace('.ejs', ''),
    ejsOptions: {
      rmWhitespace: true
    },
    sha: 256,
    customNewFileName: (filePath, fileString, md5String, baseName, extensionName) => baseName + '-' + md5String + extensionName,
    customOldFileName: (filePath, baseName, extensionName) => baseName.split('-')[0] + extensionName,
    json: 'demo/variables.json',
    es6: 'demo/variables.ts',
    less: 'demo/variables.less',
    scss: 'demo/variables.scss',
    base: 'demo',
    fileSize: 'demo/file-size.json'
  }
]
