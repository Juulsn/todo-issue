import {context as github} from "@actions/github";

const repoContext = require("../RepoContext");
import {Octokit} from "@octokit/rest";

const GitHubContext: any = jest.createMockFromModule('../GitHubContext');

const octokit = new Octokit({auth: process.env.PRIVAT_READ_TOKEN ?? process.env.GITHUB_TOKEN})

github.eventName = 'push'

GitHubContext.getCommit = jest.fn(() => ({data: {parents: {length: 1}}}))
GitHubContext.getUsername = jest.fn(() => "TestUser")

GitHubContext.getDiffFile = jest.fn(async () => {
    const diff = await octokit.repos.compareCommitsWithBasehead({
        ...repoContext.repoObject,
        basehead: `${process.env.LAST_GITHUB_SHA}...${process.env.GITHUB_SHA}`,
        headers: {Accept: 'application/vnd.github.diff'},
        method: 'GET'
    });
    return diff.data;
})

module.exports = GitHubContext