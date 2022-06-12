import github from "@actions/github";

export const owner = process.env.GITHUB_REPOSITORY!.split('/')[0];
export const repo = process.env.GITHUB_REPOSITORY!.split('/')[1];

export const repoObject = {owner, repo}

export const prNr: number | false = github?.context?.issue?.number ?? false;

//export const default_ref = process.env.GITHUB_BASE_REF;
//export const current_ref = process.env.GITHUB_REF;