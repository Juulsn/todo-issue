const github = require('@actions/github');

const repoObject = {
    owner: process.env.GITHUB_REPOSITORY?.split('/')[0],
    repo: process.env.GITHUB_REPOSITORY?.split('/')[1]
}

module.exports = {
    ...repoObject,
    repoObject,
    full_name: process.env.GITHUB_REPOSITORY,
    /*default_ref: process.env.GITHUB_BASE_REF,
    current_ref: process.env.GITHUB_REF,*/
    isPr: !!github.context.issue.number,
    pull_number: github.context.issue.number,
}
