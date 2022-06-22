import {context as github} from "@actions/github";
import {Octokit} from "@octokit/rest";
import {repoObject} from "../RepoContext";

const octokit = new Octokit({auth: process.env.PRIVAT_READ_TOKEN ?? process.env.GITHUB_TOKEN})

github.eventName = 'push'

export const getUsername = jest.fn(() => "TestUser")

export const getDiffFile = jest.fn(async () => {
    const diff = await octokit.repos.compareCommitsWithBasehead({
        ...repoObject,
        basehead: `${process.env.LAST_GITHUB_SHA}...${process.env.GITHUB_SHA}`,
        headers: {Accept: 'application/vnd.github.diff'},
        method: 'GET'
    });
    return diff.data;
})