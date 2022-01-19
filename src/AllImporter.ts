import {execSync} from "child_process";
import {AddChange, Chunk, File} from "parse-diff";
import fs from "fs";
import {argumentContext} from "./ArgumentContext";

export function importEverything(): File[] {

    console.debug("Importing all TODOs...")

    const paths: string[] = []

    argumentContext.keywords.forEach(keyword => {
        const command = "cd " + process.env.GITHUB_WORKSPACE + '\n' + 'sudo git grep -Il ' + keyword

        execSync(command, {
            encoding: 'utf8'
        }).split('\n').filter(name => name).forEach(path => {
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