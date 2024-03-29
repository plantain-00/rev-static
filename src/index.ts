import * as ejs from 'ejs'
import * as fs from 'fs'
import { createHash } from 'crypto'
import minimist from 'minimist'
import camelcase from 'camelcase'
import * as path from 'path'
import glob from 'glob'
import prettyBytes from 'pretty-bytes'
import minimatch from 'minimatch'
import * as gzipSize from 'gzip-size'
import * as chokidar from 'chokidar'
import * as packageJson from '../package.json'

import { CustomNewFileName, ConfigData, CustomOldFileName } from './core'

function md5(str: string): string {
  return createHash('md5').update(str).digest('hex')
}

function calculateSha(str: string, shaType: 256 | 384 | 512): string {
  return createHash(`sha${shaType}`).update(str).digest('base64')
}

function showToolVersion() {
  console.log(`Version: ${packageJson.version}`)
}

function showHelp() {
  console.log(`Version ${packageJson.version}
Syntax:   rev-static [options]
Examples: rev-static --config rev-static.config.js
          rev-static --config rev-static.config.ts
          rev-static --config rev-static.config.ts --watch
Options:
 -h, --help                                         Print this message.
 -v, --version                                      Print the version
 -w, --watch                                        Watch mode
 --config                                           Config file
`)
}

const htmlExtensions = ['.html', '.htm', '.ejs']

function globAsync(pattern: string, ignore?: string | string[]) {
  return new Promise<string[]>((resolve, reject) => {
    glob(pattern, { ignore }, (error, matches) => {
      if (error) {
        reject(error)
      } else {
        resolve(matches)
      }
    })
  })
}

function renderEjsAsync(filePath: string, data: ejs.Data, opts: ejs.Options) {
  return new Promise<string>((resolve, reject) => {
    ejs.renderFile(filePath, data, opts, (error, file) => {
      if (error) {
        reject(error)
      } else {
        resolve(file)
      }
    })
  })
}

function writeFileAsync(filename: string, data: string) {
  return new Promise<void>((resolve, reject) => {
    fs.writeFile(filename, data, error => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

function getVariableName(filePath: string) {
  return camelcase(path.normalize(filePath).replace(/\\|\//g, '-'))
}

function getNewFileName(fileString: string, filePath: string, customNewFileName?: CustomNewFileName) {
  const md5String = md5(fileString)
  const extensionName = path.extname(filePath)
  const baseName = path.basename(filePath, extensionName)
  if (customNewFileName) {
    return customNewFileName(filePath, fileString, md5String, baseName, extensionName)
  } else {
    return baseName + '-' + md5String + extensionName
  }
}

function getOldFileName(filePath: string, customOldFileName?: CustomOldFileName) {
  const extensionName = path.extname(filePath)
  const baseName = path.basename(filePath, extensionName)
  const dirname = path.dirname(filePath)
  if (customOldFileName) {
    return path.relative('.', path.resolve(dirname, customOldFileName(filePath, baseName, extensionName)))
  } else {
    return path.relative('.', path.resolve(dirname, baseName.split('-')[0] + extensionName))
  }
}

interface Variable {
  name: string;
  value?: string;
  file: string;
  sri?: string;
  fileSize: string;
  inline?: string;
}

function revisionCssOrJs(filePath: string, configData: ConfigData) {
  return new Promise<Variable>((resolve, reject) => {
    fs.readFile(filePath, (error, data) => {
      if (error) {
        reject(error)
      } else {
        const fileString = data.toString()
        let variableName: string
        let newFileName: string | undefined
        const isInlined = configData.inlinedFiles && configData.inlinedFiles.some(inlinedFile => minimatch(filePath, inlinedFile))
        if (configData.revisedFiles
          && configData.revisedFiles.length > 0
          && configData.revisedFiles.some(revisedFile => minimatch(filePath, revisedFile))) {
          const oldFileName = getOldFileName(filePath, configData.customOldFileName)
          variableName = getVariableName(configData.base ? path.relative(configData.base, oldFileName) : oldFileName)
          if (!isInlined) {
            newFileName = path.basename(filePath)
          }
        } else {
          variableName = getVariableName(configData.base ? path.relative(configData.base, filePath) : filePath)
          if (!isInlined) {
            newFileName = getNewFileName(fileString, filePath, configData.customNewFileName)
            fs.createReadStream(filePath).pipe(fs.createWriteStream(path.resolve(path.dirname(filePath), newFileName)))
          }
        }
        const variable: Variable = {
          name: variableName,
          value: newFileName,
          file: filePath,
          fileSize: prettyBytes(fileString.length) + ' ' + prettyBytes(gzipSize.sync(fileString)),
          sri: configData.sha ? `sha${configData.sha}-` + calculateSha(fileString, configData.sha) : undefined,
          inline: undefined
        }
        if (isInlined) {
          if (filePath.endsWith('.js')) {
            variable.inline = `<script>\n${fileString}\n</script>\n`
          } else if (filePath.endsWith('.css')) {
            variable.inline = `<style>\n${fileString}\n</style>\n`
          }
        }
        resolve(variable)
      }
    })
  })
}

function revisionHtml(htmlInputFiles: string[], htmlOutputFiles: string[], variables: Variable[], configData: ConfigData) {
  variables.sort((v1, v2) => v1.name.localeCompare(v2.name))

  const newFileNames: { [name: string]: string } = {}
  const inlineVariables: { [name: string]: string } = {}
  const sriVariables: { [name: string]: string } = {}
  const fileSizes: { [name: string]: string } = {}
  for (const variable of variables) {
    if (variable.value) {
      newFileNames[variable.name] = variable.value
    }
    if (variable.inline) {
      inlineVariables[variable.name] = variable.inline
    }
    if (variable.sri) {
      sriVariables[variable.name] = variable.sri
    }
    fileSizes[variable.name] = variable.fileSize
  }
  const context = Object.assign({ inline: inlineVariables }, { sri: sriVariables }, newFileNames, { context: configData.context })
  const ejsOptions = configData.ejsOptions ? configData.ejsOptions : {}
  Promise.all(htmlInputFiles.map(file => renderEjsAsync(file, context, ejsOptions))).then(fileStrings => {
    for (let i = 0; i < fileStrings.length; i++) {
      const fileString = fileStrings[i]!
      const htmlOutputFile = htmlOutputFiles[i]!
      writeFileAsync(htmlOutputFile, fileString).then(() => {
        console.log(`Success: to "${htmlOutputFiles[i]}" from "${htmlInputFiles[i]}".`)
      })

      const variableName = getVariableName(htmlOutputFile)
      fileSizes[variableName] = prettyBytes(fileString.length) + ' ' + prettyBytes(gzipSize.sync(fileString))
    }

    if (configData.fileSize) {
      writeFileAsync(configData.fileSize, JSON.stringify(fileSizes, null, '  ')).then(() => {
        console.log(`Success: to "${configData.fileSize}".`)
      })
    }
  })
}

function isImage(key: string) {
  return key !== 'sri' && key !== 'inline' && !key.endsWith('Js') && !key.endsWith('Html') && !key.endsWith('Css')
}

function statAsync(file: string) {
  return new Promise<fs.Stats | undefined>((resolve) => {
    fs.stat(file, (error, stats) => {
      if (error) {
        resolve(undefined)
      } else {
        resolve(stats)
      }
    })
  })
}

async function executeCommandLine() {
  const argv = minimist(process.argv.slice(2), { '--': true }) as unknown as {
    v?: unknown
    version?: unknown
    w?: unknown
    watch?: unknown
    h?: unknown
    help?: unknown
    config?: string
  }

  const showVersion = argv.v || argv.version
  if (showVersion) {
    showToolVersion()
    return
  }

  if (argv.h || argv.help) {
    showHelp()
    return
  }

  let configFilePath: string
  if (argv.config) {
    configFilePath = path.resolve(process.cwd(), argv.config)
  } else {
    configFilePath = path.resolve(process.cwd(), 'rev-static.config.ts')
    const stats = await statAsync(configFilePath)
    if (!stats || !stats.isFile()) {
      configFilePath = path.resolve(process.cwd(), 'rev-static.config.js')
    }
  }
  if (configFilePath.endsWith('.ts')) {
    require('ts-node/register/transpile-only')
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let configFileData: (ConfigData | ConfigData[]) & { default?: ConfigData | ConfigData[] } = require(configFilePath)
  if (configFileData.default) {
    configFileData = configFileData.default;
  }
  const configDatas = Array.isArray(configFileData) ? configFileData : [configFileData]

  const watchMode = argv.w || argv.watch

  for (const configData of configDatas) {
    if (!configData.inputFiles || configData.inputFiles.length === 0) {
      throw new Error('Error: no input files.')
    }

    const uniqFiles = await globAsync(configData.inputFiles.length === 1 ? configData.inputFiles[0]! : `{${configData.inputFiles.join(',')}}`, configData.excludeFiles)
    const htmlInputFiles: string[] = []
    const jsCssInputFiles: string[] = []
    const htmlOutputFiles: string[] = []

    for (const file of uniqFiles) {
      if (isHtmlExtension(file)) {
        htmlInputFiles.push(file)
        htmlOutputFiles.push(configData.outputFiles(file))
      } else {
        jsCssInputFiles.push(file)
      }
    }

    if (watchMode) {
      const variables: Variable[] = []
      let count = 0
      chokidar.watch(configData.inputFiles, { ignored: configData.excludeFiles }).on('all', (type: string, file: string) => {
        console.log(`Detecting ${type}: ${file}`)
        if (type === 'add' || type === 'change') {
          if (isHtmlExtension(file)) {
            const index = htmlInputFiles.findIndex(f => f === file)
            if (index === -1) {
              htmlInputFiles.push(file)
              htmlOutputFiles.push(configData.outputFiles(file))
            } else {
              htmlInputFiles[index] = file
              htmlOutputFiles[index] = configData.outputFiles(file)
            }
            count++
            if (count > uniqFiles.length) {
              revisionHtml(htmlInputFiles, htmlOutputFiles, variables, configData)
            } else if (count === uniqFiles.length) {
              revisionHtml(htmlInputFiles, htmlOutputFiles, variables, configData)
              writeVariables(configData, variables)
            }
          } else {
            revisionCssOrJs(file, configData).then(variable => {
              const index = variables.findIndex(v => v.file === file)
              if (index === -1) {
                variables.push(variable)
              } else {
                const oldVariable = variables[index]!
                if (oldVariable.value && oldVariable.value !== variable.value) {
                  const oldFile = path.resolve(path.dirname(oldVariable.file), oldVariable.value)
                  console.log(`Removing ${oldFile}`)
                  fs.unlink(oldFile, error => {
                    if (error) {
                      console.log(error)
                    }
                  })
                }
                variables[index] = variable
              }
              count++

              if (count >= uniqFiles.length) {
                revisionHtml(htmlInputFiles, htmlOutputFiles, variables, configData)
                writeVariables(configData, variables)
              }
            })
          }
        } else if (type === 'unlink') {
          if (isHtmlExtension(file)) {
            const index = htmlInputFiles.findIndex(f => f === file)
            if (index !== -1) {
              htmlInputFiles.splice(index, 1)
              htmlOutputFiles.splice(index, 1)
              revisionHtml(htmlInputFiles, htmlOutputFiles, variables, configData)
            }
          } else {
            const index = variables.findIndex(v => v.file === file)
            if (index !== -1) {
              variables.splice(index, 1)
              revisionCssOrJs(file, configData).then(() => {
                revisionHtml(htmlInputFiles, htmlOutputFiles, variables, configData)
                writeVariables(configData, variables)
              })
            }
          }
        }
      })
    } else if (uniqFiles.length > 0) {
      const variables = await Promise.all(jsCssInputFiles.map(file => revisionCssOrJs(file, configData)))
      revisionHtml(htmlInputFiles, htmlOutputFiles, variables, configData)
      writeVariables(configData, variables)
    }
  }
}

function isHtmlExtension(file: string) {
  return htmlExtensions.indexOf(path.extname(file).toLowerCase()) !== -1
}

function writeVariables(configData: ConfigData, variables: Variable[]) {
  variables.sort((v1, v2) => v1.name.localeCompare(v2.name))

  const newFileNames: { [name: string]: string } = {}
  const fileSizes: { [name: string]: string } = {}
  for (const variable of variables) {
    if (variable.value) {
      newFileNames[variable.name] = variable.value
    }
    fileSizes[variable.name] = variable.fileSize
  }

  if (configData.json) {
    writeFileAsync(configData.json, JSON.stringify(newFileNames, null, '  ')).then(() => {
      console.log(`Success: to "${configData.json}".`)
    })
  } else {
    console.log(`File Renamed To: ${JSON.stringify(newFileNames, null, '  ')}`)
  }

  if (configData.es6) {
    const result: string[] = []
    for (const variable of variables) {
      if (isImage(variable.name) && variable.value !== undefined) {
        result.push(`export const ${variable.name} = "${variable.value}";\n`)
      }
    }

    writeFileAsync(configData.es6, result.join('')).then(() => {
      console.log(`Success: to "${configData.es6}".`)
    })
  }

  if (configData.less) {
    const result: string[] = []
    for (const variable of variables) {
      if (isImage(variable.name) && variable.value !== undefined) {
        result.push(`@${variable.name}: '${variable.value}';\n`)
      }
    }

    writeFileAsync(configData.less, result.join('')).then(() => {
      console.log(`Success: to "${configData.less}".`)
    })
  }

  if (configData.scss) {
    const result: string[] = []
    for (const variable of variables) {
      if (isImage(variable.name) && variable.value !== undefined) {
        result.push(`$${variable.name}: '${variable.value}';\n`)
      }
    }

    writeFileAsync(configData.scss, result.join('')).then(() => {
      console.log(`Success: to "${configData.scss}".`)
    })
  }
}

executeCommandLine().then(() => {
  console.log('rev-static success.')
}, (error: unknown) => {
  if (error instanceof Error) {
    console.log(error.message)
  } else {
    console.log(error)
  }
  process.exit(1)
})
