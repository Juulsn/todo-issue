import {Todo} from "./Todo";
import {lineBreak} from "./helpers";
import {template} from "./templates";
import {Octokit} from "@octokit/rest";
import {repoObject} from "./RepoContext";
import core from "@actions/core";

const octokit = new Octokit({auth: process.env.GITHUB_TOKEN})

let rateLimit = 0;

export async function checkRateLimit(decrease = true) {

    if (rateLimit == 0) {

        let rate = await octokit.rateLimit.get();
        rateLimit = rate.data.rate.remaining

        if (rate.data.rate.remaining == 0) {
            const timeToWaitInMillis = (rate.data.rate.reset * 1000) - Date.now();
            core.debug(`Waiting ${timeToWaitInMillis / 1000} seconds because of githubs api rate limit`)
            await new Promise(resolve => setTimeout(resolve, timeToWaitInMillis))
        }

        rate = await octokit.rateLimit.get();
        rateLimit = rate.data.rate.remaining;
    }

    if (decrease)
        rateLimit--;

    return;
}

export async function addTodo(todo: Todo) {

    const body = lineBreak(template.issue(
        {
            ...repoObject,
            body: todo.bodyComment,
            ...todo
        })
    )

    core.info(`Creating issue with title [${todo.title}] because of a comment`)

    const val = await octokit.issues.create({
        ...repoObject,
        title: todo.title,
        body,
        labels: todo.labels,
        assignees: todo.assignees
    })

    todo.issueId = val.data.number;

    await checkRateLimit();

    core.debug(`Issue [${todo.title}] got ID ${todo.issueId}`)
}

export async function updateTodo(todo: Todo) {

    if (!todo.issueId) {
        core.error(`Can't update issue [${todo.title}]! No issueId found`)
        return
    }

    core.debug(`Updating issue #${todo.issueId} because the title were changed`)

    let val = await octokit.issues.update({
        ...repoObject,
        issue_number: todo.issueId,
        title: todo.title,
        // assignees will not get an update because it was probably just a typo fix
    })

    await checkRateLimit()

    return val;
}

export async function closeTodo(todo: Todo) {

    if (!todo.issueId) {
        core.error(`Can't close issue [${todo.title}]! No issueId found`)
        return
    }

    const body = lineBreak(template.close(
        {
            ...repoObject,
            body: todo.bodyComment,
            ...todo
        })
    )

    core.debug(`Closing issue #${todo.issueId} because a comment with the title [${todo.title}] were removed`)

    await octokit.issues.createComment({
        ...repoObject,
        issue_number: todo.issueId,
        body,
    })

    await checkRateLimit();

    let val = await octokit.issues.update({
        ...repoObject,
        issue_number: todo.issueId,
        state: 'closed'
    })

    await checkRateLimit();

    return val;
}

export async function reopenTodo(todo: Todo) {

    if (!todo.issueId) {
        core.error(`Can't reopen issue [${todo.title}]! No issueId found`)
        return
    }

    core.info(`Reopening issue #${todo.issueId} because there is a new issue with the same or a similar name`)

    let val = await octokit.issues.update({
        ...repoObject,
        issue_number: todo.issueId,
        state: 'open'
    })

    await checkRateLimit();

    return val;
}

async function updateAssignees(todo: Todo) {

    if (!todo.assignees?.length) return
    if (!todo.issueId) return

    const val = await octokit.issues.update({
        ...repoObject,
        issue_number: todo.issueId,
        assignees: todo.assignees,
    })

    await checkRateLimit();

    return val;
}

export async function addReferenceTodo(todo: Todo) {

    const body = lineBreak(template.comment(
        {
            ...repoObject,
            body: todo.bodyComment,
            ...todo
        })
    )

    if (!todo.similarTodo?.issueId) {
        core.error(`Can't add reference for [${todo.title}] to issue [${todo.similarTodo?.title}]. No issueId found`)
        return
    }

    core.info(`Adding a reference to the issue #${todo.similarTodo.issueId} with title [${todo.similarTodo?.title}] because it is similar to a the new issue [${todo.title}]`)

    const comment = await octokit.issues.createComment({
        ...repoObject,
        issue_number: todo.similarTodo.issueId,
        body
    })

    await checkRateLimit()

    await updateAssignees(todo.similarTodo)

    return comment

}