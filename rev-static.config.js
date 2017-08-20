module.exports = [
  {
    inputFiles: [
      'demo/book.js',
      'demo/movie-42a7b8c.js',
      'demo/shop.js',
      'demo/book.css',
      'demo/shop.css',
      'demo/test.png',
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
