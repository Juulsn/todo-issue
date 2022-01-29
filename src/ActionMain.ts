import {Todo} from "./Todo";

import {reopenTodo, sleep} from "./TodoHandler";

import {context as github} from "@actions/github";
import * as core from "@actions/core";

const {argumentContext} = require("./ArgumentContext");
const {getIssues} = require("./GitHubContext");
const {generateTodosFromCommit} = require("./Todo");
const {cleanUpTodos} = require("./TodoMatcher");
const {addTodo, closeTodo, addReferenceTodo, updateTodo} = require("./TodoHandler");

module.exports = async () => {

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

        result.data.forEach((each: any) => {

            if (each.pull_request)
                return

            console.debug(`Importing issue [${each.number}]`)

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

        if(page % 5 == 0){
            console.debug("Waiting 2 seconds because of github api rate limit")
            await sleep(2000);
        }
    }

    console.log(`${existingTodos.length} TODOs imported`)

    todos = cleanUpTodos(todos, existingTodos);

    const toAdd = todos.filter(value => value.type == "add");
    console.log(`Adding ${toAdd.length} issues`)
    for (const value of toAdd) {
        try {
            await addTodo(value);
        } catch (e) {
            console.warn(e)
        }
    }

    if (argumentContext.importAll) return

    const toClose = todos.filter(value => value.type == "del");
    console.log(`Closing ${toClose.length} issues`)
    for (const value of toClose) {
        try {
            await closeTodo(value);
        } catch (e) {
            console.warn(e)
        }
    }

    const toUpdate = todos.filter(value => value.type == "update");
    console.log(`Updating ${toUpdate.length} issues`)
    for (const value of toUpdate) {
        try {
            await updateTodo(value);
        } catch (e) {
            console.warn(e)
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
                console.warn(e)
            }
            value.similarTodo.open = true;
        }
    }
    for (const value of toAddReference) {
        try {
            await addReferenceTodo(value);
        } catch (e) {
            console.warn(e)
        }
    }

};