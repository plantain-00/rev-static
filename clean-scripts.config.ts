import { checkGitStatus } from 'clean-scripts'

const tsFiles = `"src/**/*.ts"`

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
    ts: `eslint --ext .js,.ts ${tsFiles}`,
    export: `no-unused-export ${tsFiles}`,
    markdown: `markdownlint README.md`,
    typeCoverage: 'type-coverage -p src --strict'
  },
  test: [
    'clean-release --config clean-run.config.ts',
    () => checkGitStatus()
  ],
  fix: `eslint --ext .js,.ts ${tsFiles} --fix`,
  watch: {
    src: `${tscSrcCommand} --watch`,
    demo: `${demoCommand} --watch`
  }
}
