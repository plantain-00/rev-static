module.exports = {
  build: [
    `rimraf dist/`,
    `tsc -p src`
  ],
  lint: {
    ts: `tslint "src/**/*.ts" "spec/*.ts"`,
    js: `standard "**/*.config.js"`,
    export: `no-unused-export "src/**/*.ts" "spec/*.ts"`
  },
  test: [
    'tsc -p spec',
    'jasmine'
  ],
  fix: {
    ts: `tslint --fix "src/**/*.ts" "spec/*.ts"`,
    js: `standard --fix "**/*.config.js"`
  },
  release: `clean-release`
}
