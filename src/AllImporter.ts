import {execSync} from "child_process";
import {AddChange, Chunk, File} from "parse-diff";
import fs from "fs";
import {argumentContext} from "./ArgumentContext";

export function importEverything(): File[] {

    console.debug("Importing all TODOs...")

    const paths: string[] = []

    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();

    argumentContext.keywords.forEach(keyword => {
        // Build robust git grep command:
        // -I: ignore binary files
        // -l: print just file names
        // -F: interpret pattern as a fixed string (not regex)
        // -i: ignore case when caseSensitive is false
        const flags = ["-I", "-l", "-F"]; // always apply these
        if (!argumentContext.caseSensitive) flags.unshift("-i");

        // Safely single-quote the keyword for the shell
        const quotedKeyword = `'${keyword.replace(/'/g, "'\\''")}'`;

        const command = `cd ${workspace} && git grep ${flags.join(" ")} -- ${quotedKeyword}`;

        const stdout = String(execSync(command, { encoding: 'utf8' }));
        stdout.split('\n').filter(name => name).forEach(path => {
            if (!paths.includes(path)) {
                paths.push(path)
            }
        });
    })

    const files: File[] = []

    paths.forEach(file => {

        const changes: AddChange[] = []

        const data = fs.readFileSync(file, 'utf8');
        data.split('\n').forEach((value, index) => {
            changes.push({
                ln: index + 1,
                add: true,
                type: "add",
                content: value
            })
        })

        const parseFile: File = {
            additions: 0,
            deletions: 0,
            new: true,
            chunks: [{changes} as Chunk],
            to: file
        }
        files.push(parseFile)
    })

    return files

}