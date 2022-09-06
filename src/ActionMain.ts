import {generateTodosFromCommit, Todo} from "./Todo";
import {context as github} from "@actions/github";
import {argumentContext} from "./ArgumentContext";
import {cleanUpTodos} from "./TodoMatcher";
import {GitHubTaskSystem} from "./TaskSystems/GithubTaskSystem";
import {currentTaskSystem, setTaskSystem, ITaskSystem} from "./TaskSystem";
import {debug, error, info, setFailed, warning} from "@actions/core";


export default async () => {

    if (!checkEventTrigger())
        return

    const taskSystem = getTaskSystem();

    if (!taskSystem)
        return;

    setTaskSystem(taskSystem);

    if (!argumentContext.keywords.length) {
        setFailed('No keywords were specified!')
        return
    }

    await taskSystem.checkRateLimit(false);

    debug('Search for TODOs...')

    let todos: Todo[] = await generateTodosFromCommit();

    debug(`${todos.length} TODOs found`)

    if (!todos.length) return

    const existingTodos: Todo[] = await currentTaskSystem().getTodos();
    debug(`${existingTodos.length} TODOs imported`)

    todos = cleanUpTodos(todos, existingTodos);

    await handleTodos(todos.filter(value => value.type == "add"), taskSystem.addTodo);

    if (argumentContext.importAll) return

    await handleTodos(todos.filter(value => value.type == "del"), taskSystem.closeTodo);
    await handleTodos(todos.filter(value => value.type == "update"), taskSystem.updateTodo)

    if (!argumentContext.reopenClosed) return

    const toAddReference = todos.filter(value => value.type == "addReference");
    const toReopenIssues = [...new Map(toAddReference.filter(value => value.similarTodo?.type === "exists" && value.similarTodo.open === false && value.similarTodo.issueId !== false).map(item => [item.issueId, item])).values()];

    await handleTodos(toReopenIssues, taskSystem.reopenTodo);
    await handleTodos(toAddReference, taskSystem.addReferenceTodo);
}

function checkEventTrigger() : boolean {
    if (argumentContext.importAll) {
        if (github.eventName !== 'workflow_dispatch'){
            setFailed('importAll can only be used on trigger workflow_dispatch')
            return false
        }

        info('Import all mode. Adding all TODOs from codebase which were not created yet')
    } else if (github.eventName !== 'push'){
        setFailed('Action can only be used on trigger push or in manual and importAll mode')
        return false
    }

    return true
}

function getTaskSystem(): ITaskSystem | undefined {
    switch (argumentContext.taskSystem) {
        case "GitHub":
            setTaskSystem(new GitHubTaskSystem());
            break
        default:
            setFailed(`${argumentContext.taskSystem} can not be used at the time. You may open a Issue or PR to support this task system`);
            return
    }

    return currentTaskSystem();
}

async function handleTodos(todos: Todo[], method: (todo: Todo) => Promise<void>) {
    const context = currentTaskSystem();

    debug(`Handle ${todos.length} issues, ${method.name}`)
    for (const value of todos) {
        try {
            await method(value);
        } catch (e) {

            if (isRateLimitError(e as Error)) {
                //wait and retry
                await context.checkRateLimit(false);
                await method(value);
            } else {
                error(e as Error);
                throw e;
            }
        }
    }
}

function isRateLimitError(e: Error) {
    return (e).message.includes("rate limit");
}