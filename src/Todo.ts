import {Chunk, File} from "parse-diff";
import {argumentContext} from "./ArgumentContext";
import * as FileHelper from './FileHelper'
import {importEverything} from "./AllImporter";
import {stripAt} from "./helpers";

const repoContext = require("./RepoContext");
const  {checkForBody, getDetails} = require("./TodoDetails");

const parseDiff = require('parse-diff')
const {getDiffFile, getLabels} = require('./GitHubContext')

async function generateTodosFromCommit() {

  const todos: Todo[] = []

  // RegEx that matches lines with the configured keywords
  const regex = new RegExp(`^(?<beforeTag>\\W+)(?<keyword>${argumentContext.keywords.join('|')})\\b\\W*(?<title>.*)`, (!argumentContext.caseSensitive ? 'i' : ''))

  let files: File[];

  // Diff as files or import all
  if (argumentContext.importAll) {
    files = importEverything();
  } else {
    // Get the diff for this commit or PR
    const diff = await getDiffFile()
    if (!diff) return todos

    files = parseDiff(diff)
  }

  // Ensure that all the labels we need are present
  const labels = await getLabels()

  await Promise.all(files.map(async file => {
    if(!file.to) return
    if (FileHelper.shouldExcludeFile(file.to)) return

    // Loop through every chunk in the file
    await Promise.all(file.chunks.map(async chunk => {
      // Chunks can have multiple changes
      await Promise.all(chunk.changes.map(async (change, index) => {

        if (change.type === "normal")
          return;

        const changedLine = change.ln;

        // Attempt to find a matching line
        const matches = regex.exec(change.content)
        if (!matches || !matches.groups) return

        // Trim whitespace to ensure a clean title
        let title = matches.groups.title.trim()

        if (title.endsWith('-->')) {
          title = title.slice(0, title.length - 3)
          // TODO Add to regex :)
        }

        // GitHub wouldn't allow this, so let's ignore it.
        if (!title) return

        // Get the details of this commit or PR
        const details = getDetails(chunk, changedLine)

        let bodyComment : string = checkForBody(chunk.changes, index, matches.groups.beforeTag);

        if(title.length > 256) {

          let wholeTitle = title + '<br><br>';

          if(bodyComment)
            bodyComment = wholeTitle + bodyComment
          else
            bodyComment = wholeTitle

          title = title.slice(0, 100) + '...'
        }

        // add assignees mentioned in comment body
        `${bodyComment}`.match(new RegExp(`@[a-zA-Z0-9@._-]+\\b`))?.map(value => stripAt(value)).forEach(value => !details.assignees.includes(value) && details.assignees.push(value))

        console.log(`Item found [${title}] in [${repoContext.full_name}]`)

        todos.push({
          type: change.type,
          keyword: matches.groups.keyword,
          filename: file.to,
          escapedFilename: encodeURI(file.to as string),
          sha: process.env.GITHUB_SHA,
          bodyComment,
          changedLine,
          title,
          chunk,
          index,
          labels,
          ...details
        } as Todo);
      }))
    }))
  }))

  return todos;
}

export declare type Todo = {
  type: 'add' | 'update' | 'del' | 'addReference' | 'exists' | 'ignore'
  keyword: string
  bodyComment: string
  filename: string
  escapedFilename: string
  sha: string
  changedLine: number
  title: string
  chunk: Chunk
  index: number
  labels: string[]
  similarTodo: Todo | undefined
  username: string
  assignedToString: string
  assignees: string[]
  number: number | false
  issueId: number | false
  open: boolean | undefined
  range: string
}

module.exports = {
  generateTodosFromCommit,
}