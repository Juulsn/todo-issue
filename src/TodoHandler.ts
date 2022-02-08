import {Todo} from "./Todo";
import {lineBreak} from "./helpers";
import {template} from "./templates";
import {Octokit} from "@octokit/rest";

const octokit = new Octokit({auth: process.env.GITHUB_TOKEN})

let rateLimit = 0;

const repoContext = require("./RepoContext");

export async function checkRateLimit(decrease = true) {

    if (rateLimit == 0) {

        let rate = await octokit.rateLimit.get();
        rateLimit = rate.data.rate.remaining

        if (rate.data.rate.remaining == 0) {
            const timeToWaitInMillis = (rate.data.rate.reset * 1000) - Date.now();
            console.debug(`Waiting ${timeToWaitInMillis / 1000} seconds because of githubs api rate limit`)
            await new Promise(resolve => setTimeout(resolve, timeToWaitInMillis))
        }

        rate = await octokit.rateLimit.get();
        rateLimit = rate.data.rate.remaining;
    }

    if(decrease)
        rateLimit--;

    return;
}

export async function addTodo(todo: Todo) {

    const body = lineBreak(template.issue(
        {
            ...repoContext.repoObject,
            body: todo.bodyComment,
            ...todo
        })
    )

    console.debug(`Creating issue [${todo.title}]`)

    const val = await octokit.issues.create({
        ...repoContext.repoObject,
        title: todo.title,
        body,
        labels: todo.labels,
        assignees: todo.assignees
    })

    todo.issueId = val.data.number;

    await checkRateLimit();

    console.debug(`Issue [${todo.title}] got ID ${todo.issueId}`)
}

export async function updateTodo(todo: Todo) {

    if (!todo.issueId) {
        console.error(`Can't update issue [${todo.title}]! No issueId found`)
        return
    }

    console.debug(`Updating issue [${todo.issueId}]`)

    let val = await octokit.issues.update({
        ...repoContext.repoObject,
        issue_number: todo.issueId,
        title: todo.title,
        // assignees will not get an update because it was probably just a typo fix
    })

    await checkRateLimit()

    return val;
}

export async function closeTodo(todo: Todo) {

    if (!todo.issueId) {
        console.error(`Can't close issue [${todo.title}]! No issueId found`)
        return
    }

    const body = lineBreak(template.close(
        {
            ...repoContext.repoObject,
            body: todo.bodyComment,
            ...todo
        })
    )

    console.debug(`Closing issue [${todo.issueId}]`)

    await octokit.issues.createComment({
        ...repoContext.repoObject,
        issue_number: todo.issueId,
        body,
    })

    await checkRateLimit();

    let val = await octokit.issues.update({
        owner: repoContext.owner,
        repo: repoContext.repo,
        issue_number: todo.issueId,
        state: 'closed'
    })

    await checkRateLimit();

    return val;
}

export async function reopenTodo(todo: Todo) {

    if (!todo.issueId) {
        console.error(`Can't reopen issue [${todo.title}]! No issueId found`)
        return
    }

    console.debug(`Reopening issue [${todo.issueId}]`)

    let val = await octokit.issues.update({
        ...repoContext.repoObject,
        issue_number: todo.issueId,
        state: 'open'
    })

    await checkRateLimit();

    return val;
}

async function updateAssignees(todo: Todo) {
    if (!todo.assignees?.length) return

    const val = await octokit.issues.update({
        ...repoContext.repoObject,
        issue_number: todo.issueId,
        assignees: todo.assignees,
    })

    await checkRateLimit();

    return val;
}

export async function addReferenceTodo(todo: Todo) {

    const body = lineBreak(template.comment(
        {
            ...repoContext.repoObject,
            body: todo.bodyComment,
            ...todo
        })
    )

    if (!todo.similarTodo?.issueId) {
        console.error(`Can't add reference for [${todo.title}] to issue [${todo.similarTodo?.title}]. No issueId found`)
        return
    }

    console.debug(`Adding reference to issue [${todo.similarTodo.issueId}]`)

    const comment = await octokit.issues.createComment({
        ...repoContext.repoObject,
        issue_number: todo.similarTodo.issueId,
        body
    })

    await checkRateLimit()

    await updateAssignees(todo.similarTodo)

    return comment

}