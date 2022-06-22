import {Octokit} from "@octokit/rest";
import {context as github} from "@actions/github";
import {repoObject} from "./RepoContext";

export const octokit = new Octokit({auth: process.env.PRIVAT_READ_TOKEN ?? process.env.GITHUB_TOKEN})

/**
 * @returns raw diff data
 */
export async function getDiffFile() : Promise<string | undefined> {
    try {
        console.debug(`${github.payload.commits.length} commits pushed`)

        let diff = await octokit.repos.compareCommitsWithBasehead({
            ...repoObject,
            // if payload.created is true it is most likely a new repo. But we don't want the initial commit to trigger create new issues, so it's okay if payload.before is 'empty'
            basehead: `${github.payload.before}...${process.env.GITHUB_SHA}`,
            headers: {Accept: 'application/vnd.github.diff'},
            method: 'GET'
        });

        // data is string because of headers: {Accept: 'application/vnd.github.diff'})
        return diff?.data as any
    } catch (e) {
        console.error(e)
        console.error("Diff file might be too big")
        return undefined
    }
}

export function getUsername() {
    return github.payload.head_commit?.author?.username
}