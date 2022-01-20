import {Todo} from "./Todo";
import {assignFlow, lineBreak} from "./helpers";
import {template} from "./templates";
import {Octokit} from "@octokit/rest";

const octokit = new Octokit({auth: process.env.GITHUB_TOKEN})

const repoContext = require("./RepoContext");

async function sleep(milliseconds: number) {
  return await new Promise(resolve => setTimeout(resolve, milliseconds));
}

export async function addTodo(todo: Todo) {

  const body = lineBreak(template.issue(
      {
        ...repoContext.repoObject,
        body: todo.bodyComment,
        ...todo
      })
  )

  console.log(`Creating issue [${todo.title}]`)

  await sleep(1000);

  const val = await octokit.issues.create({
    ...repoContext.repoObject,
    title: todo.title,
    body,
    labels: todo.labels,
    assignees: todo.assignees
  })

  todo.issueId = val.data.number;

  console.log(`Issue [${todo.title}] got ID ${todo.issueId}`)
}

export async function updateTodo(todo: Todo) {

  if (!todo.issueId) {
    console.error(`Can't update issue [${todo.title}]! No issueId found`)
    return
  }

  console.debug(`Updating issue [${todo.issueId}]`)

  return await octokit.issues.update({
    ...repoContext.repoObject,
    issue_number: todo.issueId,
    title: todo.title,
    // assignees will not get an update because it was probably just a typo fix
  })
}

export async function closeTodo(todo: Todo) {

  if (!todo.issueId) {
    console.error(`Can't close issue [${todo.title}]! No issueId found`)
    return
  }

  console.debug(`Closing issue [${todo.issueId}]`)

  // TODO Send comment before close?

  return await octokit.issues.update({
    owner: repoContext.owner,
    repo: repoContext.repo,
    issue_number: todo.issueId,
    state: 'closed'
  })
}

export async function reopenTodo(todo: Todo) {

  if (!todo.issueId) {
    console.error(`Can't reopen issue [${todo.title}]! No issueId found`)
    return
  }

  console.debug(`Reopening issue [${todo.issueId}]`)

  return await octokit.issues.update({
    ...repoContext.repoObject,
    issue_number: todo.issueId,
    state: 'open'
  })
}

async function updateAssignees(todo: Todo){
  if(!todo.assignees?.length) return

  return await octokit.issues.update({
    ...repoContext.repoObject,
    issue_number: todo.issueId,
    assignees: todo.assignees,
  })
}

export async function addReferenceTodo(todo: Todo) {

  const body = lineBreak(template.comment(
      {
        ...repoContext.repoObject,
        body: todo.bodyComment,
        ...todo
      })
  )

  if(!todo.similarTodo?.issueId){
    console.error(`Can't add reference for [${todo.title}] to issue [${todo.similarTodo?.title}]. No issueId found`)
    return
  }

  console.debug(`Adding reference to issue [${todo.similarTodo.issueId}]`)

  const comment = await octokit.issues.createComment({
    ...repoContext.repoObject,
    issue_number: todo.similarTodo.issueId,
    body
  })

  await updateAssignees(todo.similarTodo)

  return comment

}