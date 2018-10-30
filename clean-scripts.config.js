const { checkGitStatus } = require('clean-scripts')

const tsFiles = `"src/**/*.ts" "spec/**/*.ts"`
const jsFiles = `"*.config.js"`

const tscSrcCommand = `tsc -p src`
const demoCommand = 'node dist/index.js'

module.exports = {
  build: [
    `rimraf dist/`,
    tscSrcCommand,
    'rimraf demo/book-*.* demo/shop-*.* demo/test-*.png demo/variables.* demo/index.html demo/home.html demo/file-size.json',
    demoCommand
  ],
  lint: {
    ts: `tslint ${tsFiles}`,
    js: `standard ${jsFiles}`,
    export: `no-unused-export ${tsFiles}`,
    commit: `commitlint --from=HEAD~1`,
    markdown: `markdownlint README.md`,
    typeCoverage: 'type-coverage -p src --at-least 99'
  },
  test: [
    'tsc -p spec',
    'jasmine',
    'clean-release --config clean-run.config.js',
    () => checkGitStatus()
  ],
  fix: {
    ts: `tslint --fix ${tsFiles}`,
    js: `standard --fix ${jsFiles}`
  },
  watch: {
    src: `${tscSrcCommand} --watch`,
    demo: `${demoCommand} --watch`
  }
}
