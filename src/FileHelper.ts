import {argumentContext} from "./ArgumentContext";

export function shouldExcludeFile(fileName: string) {

    const alwaysExclude = /\.min\./

    if (fileName.startsWith('.github') && fileName.endsWith('.yml')) {
        console.debug(`Skipping ${fileName} as it is a .yml file in the .github folder`)
        return true
    } else if (alwaysExclude.test(fileName)) {
        console.debug(`Skipping ${fileName} as it matches the the alwaysExclude pattern`)
        return true
    } else if (argumentContext.excludePattern && new RegExp(argumentContext.excludePattern).test(fileName)) {
        console.debug(`Skipping ${fileName} as it matches the exclude pattern ${argumentContext.excludePattern}`)
        return true
    }
}
