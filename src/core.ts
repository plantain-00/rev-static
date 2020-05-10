
export interface ConfigData {
  inputFiles: string[];
  excludeFiles?: string[];
  revisedFiles?: string[];
  inlinedFiles?: string[];
  outputFiles: ((file: string) => string);
  json?: string;
  ejsOptions?: ejs.Options;
  sha?: 256 | 384 | 512;
  customNewFileName?: CustomNewFileName;
  customOldFileName?: CustomOldFileName;
  es6?: string;
  less?: string;
  scss?: string;
  base?: string;
  fileSize?: string;
  context?: unknown;
}

export type CustomNewFileName = (filePath: string, fileString: string, md5String: string, baseName: string, extensionName: string) => string

export type CustomOldFileName = (filePath: string, baseName: string, extensionName: string) => string
