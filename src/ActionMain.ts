import {generateTodosFromCommit, Todo} from "./Todo";
import {reopenTodo, checkRateLimit, addTodo, closeTodo, addReferenceTodo, updateTodo} from "./TodoHandler";
import {context as github} from "@actions/github";
import * as core from "@actions/core";
import {argumentContext} from "./ArgumentContext";
import {getIssues} from "./GitHubContext";
import {cleanUpTodos} from "./TodoMatcher";

export default async () => {

    await checkRateLimit(false);

    if (argumentContext.importAll) {
        if (github.eventName !== 'workflow_dispatch') {
            core.setFailed('importAll can only be used on trigger workflow_dispatch')
            return
        }
        console.log('Import all mode. Adding all TODOs from codebase which were not created yet')
    } else if (github.eventName !== 'push') {
        core.setFailed('Action can only be used on trigger push or in manual and importAll mode')
        return
    }

    if (argumentContext.taskSystem !== "GitHub") {
        core.setFailed(`${argumentContext.taskSystem} can not be used at the time. You may open a Issue or PR to support this task system`);
        return
    }

    if (!argumentContext.keywords.length) {
        core.setFailed('No keywords were specified!')
        return
    }

    console.debug('Search for TODOs...')

    let todos: Todo[] = await generateTodosFromCommit();

    console.log(`${todos.length} TODOs found`)

    if (!todos.length) return

    const existingTodos: Todo[] = [];

    let page = 0;
    let next = true;

    while (next) {

        console.log(`Requesting issues... page ${page}`)

        const result = await getIssues(page)

        next = result.data.length === 100;
        page++;

        await checkRateLimit()

        result.data.forEach((each: any) => {

            if (each.pull_request)
                return

            console.debug(`Importing issue [#${each.number}]`)

            existingTodos.push(
                {
                    type: "exists",
                    title: each.title,
                    //bodyComment: each.body,
                    issueId: each.number,
                    open: each.state === "open",
                    assignees: each.assignees.map((assignee: any) => assignee.login)
                } as Todo)
        })
    }

    console.log(`${existingTodos.length} TODOs imported`)

    todos = cleanUpTodos(todos, existingTodos);

    const toAdd = todos.filter(value => value.type == "add");
    console.log(`Adding ${toAdd.length} issues`)
    await checkRateLimit(false);
    for (const value of toAdd) {
        try {
            await addTodo(value);
        } catch (e) {

            if(isRateLimitError(e)){
                //wait and retry
                await checkRateLimit(false);
                await addTodo(value);
                continue
            }

            console.warn(e)
            core.warning((e as Error).message);
        }
    }

    if (argumentContext.importAll) return

    const toClose = todos.filter(value => value.type == "del");
    console.log(`Closing ${toClose.length} issues`)
    for (const value of toClose) {
        try {
            await closeTodo(value);
        } catch (e) {

            if(isRateLimitError(e)){
                //wait and retry
                await checkRateLimit(false);
                await closeTodo(value);
                continue
            }

            console.warn(e);
            core.warning((e as Error).message);
        }
    }

    const toUpdate = todos.filter(value => value.type == "update");
    console.log(`Updating ${toUpdate.length} issues`)
    for (const value of toUpdate) {
        try {
            await updateTodo(value);
        } catch (e) {

            if(isRateLimitError(e)){
                //wait and retry
                await checkRateLimit(false);
                await updateTodo(value);
                continue
            }

            console.warn(e);
            core.warning((e as Error).message);
        }
    }

    if (!argumentContext.reopenClosed) return

    const toAddReference = todos.filter(value => value.type == "addReference");
    console.log(`Adding reference for ${toAddReference.length} issues`)
    for (const value of toAddReference) {
        // check if it has been already reopened
        if (value.similarTodo?.type === "exists" && value.similarTodo.open === false) {
            try {
                await reopenTodo(value.similarTodo)
            } catch (e) {

                if(isRateLimitError(e)){
                    //wait and retry
                    await checkRateLimit(false);
                    await reopenTodo(value);
                    continue
                }

                console.warn(e);
                core.warning((e as Error).message);
            }
            value.similarTodo.open = true;
        }
    }
    for (const value of toAddReference) {
        try {
            await addReferenceTodo(value);
        } catch (e) {

            if(isRateLimitError(e)){
                //wait and retry
                await checkRateLimit(false);
                await addReferenceTodo(value);
                continue
            }

            console.warn(e);
            core.warning((e as Error).message);
        }
    }
}

function isRateLimitError(e: any){
    return (e as Error).message.includes("rate limit");
}