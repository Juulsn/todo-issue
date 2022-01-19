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
async function getDiff() {
    if (github.payload?.push?.commits?.length) {
        return await octokit.repos.compareCommitsWithBasehead({
            ...repoContext.repoObject,
            basehead: `${github.payload.push.before}...${process.env.GITHUB_SHA}`,
            headers: {Accept: 'application/vnd.github.diff'},
            method: 'GET'
        });
    }
}

/**
 * @returns raw diff data
 */
async function getDiffFile() {
    // TODO Merge methods getDiffFile and getDiff
    try {
        const diff = await getDiff();
        if (diff)
            return diff.data
    } catch {
        console.error("Diff file is too big")
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

    if (!argumentContext.label === true)
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