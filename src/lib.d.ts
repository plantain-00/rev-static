declare module "lodash.flatten" {
    function flatten<T>(array: T[][]): T[];
    export = flatten;
    namespace flatten { }
}
declare module "lodash.uniq" {
    function uniq<T>(array: T[]): T[];
    export = uniq;
    namespace uniq { }
}
declare module "*.json" {
    export const version: string;
}
declare module "gzip-size" {
    function gzipSize(input: string | Buffer, callback: (error: Error, size: number) => void): string;
    export function sync(input: string | Buffer): number;
    export function stream(): any;
    export = gzipSize;
    namespace gzipSize {
        export function sync(input: string | Buffer): number;
        export function stream(): any;
    }
}
