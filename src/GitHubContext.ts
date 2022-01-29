import {argumentContext} from "./ArgumentContext";
import {Octokit} from "@octokit/rest";
import {context as github} from "@actions/github";

const repoContext = require("./RepoContext")

const octokit = new Octokit({auth: process.env.PRIVAT_READ_TOKEN ?? process.env.GITHUB_TOKEN})

/**
 *
 * @param page
 * @returns Up to 100 issues at a time
 */
async function getIssues(page: number) {
    return octokit.issues.listForRepo({
        ...repoContext.repoObject,
        per_page: 100,
        state: "all",
        page
    })
}

/**
 * @returns raw diff data
 */
async function getDiffFile() {
    try {
        console.debug(`${github.payload.commits.length} commits pushed`)

        let diff = await octokit.repos.compareCommitsWithBasehead({
            ...repoContext.repoObject,
            // if payload.created is true it is most likely a new repo. But we don't want the initial commit to trigger create new issues, so it's okay if payload.before is 'empty'
            basehead: `${github.payload.before}...${process.env.GITHUB_SHA}`,
            headers: {Accept: 'application/vnd.github.diff'},
            method: 'GET'
        });

        return diff?.data
    } catch (e) {
        console.error(e)
        console.error("Diff file might be too big")
        return
    }
}

async function getDefaultLabel() {
    const newLabel = {
        ...repoContext.repoObject,
        name: 'todo :spiral_notepad:',
        color: '00B0D8',
        request: {retries: 0},
    };

    try {
        await octokit.issues.createLabel(newLabel)
    } catch (e) {
        // Label already exists, ignore
    }

    return newLabel.name
}

async function getLabels() {

    if (argumentContext.label === false)
        return [];

    if (argumentContext.label === true)
        return [await getDefaultLabel()]

    else
        return argumentContext.label
}

function getUsername() {
    return github.payload.head_commit?.author?.username
}

module.exports = {
    getIssues,
    getDiffFile,
    getLabels,
    getUsername,
    octokit
}