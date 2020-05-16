import { ConfigData } from 'clean-release'

export default {
  include: [
    'bin/*',
    'dist/*.js',
    'package.json',
    'yarn.lock'
  ],
  exclude: [
  ],
  postScript: [
    'cd "[dir]" && yarn --production && yarn add ts-node -DE',
    'node [dir]/dist/index.js'
  ]
} as ConfigData
