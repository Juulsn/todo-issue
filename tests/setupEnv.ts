import {context as github} from "@actions/github";

// Jest setup: define environment variables required by RepoContext and others
process.env.GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || "owner/repo";
process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE || "/tmp/workspace";
process.env.GITHUB_SHA = process.env.GITHUB_SHA || "0000000000000000000000000000000000000000";
process.env.LAST_GITHUB_SHA = process.env.LAST_GITHUB_SHA || "ffffffffffffffffffffffffffffffffffffffff";
process.env.TZ = "UTC";

github.eventName = github.eventName || "push";
github.payload.before = github.payload.before || process.env.LAST_GITHUB_SHA;
github.payload.commits = github.payload.commits || [];
github.payload.head_commit = github.payload.head_commit || {
    author: {username: "TestUser"}
};
