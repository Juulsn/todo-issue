import {Chunk, File} from "parse-diff";
import {argumentContext} from "./ArgumentContext";
import * as FileHelper from './FileHelper'
import {importEverything} from "./AllImporter";

const repoContext = require("./RepoContext");
const  {checkForBody, getDetails} = require("./TodoDetails");

const parseDiff = require('parse-diff')
const {getDiffFile, getLabels} = require('./GitHubContext')

async function generateTodosFromCommit() {

  const todos: Todo[] = []

  // Get the diff for this commit or PR
  const diff = await getDiffFile()
  if (!diff) return todos

  // Ensure that all the labels we need are present
  const labels = await getLabels()

  if (!argumentContext.keywords.length) return todos

  // RegEx that matches lines with the configured keywords
  const regex = new RegExp(`^(?<beforeTag>\\W+)(?<keyword>${argumentContext.keywords.join('|')})\\b\\W*(?<title>.*)`, (!argumentContext.caseSensitive ? 'i' : ''))

  // Parse the diff as files or import all
  const files: File[] = argumentContext.importAll ? importEverything() : parseDiff(diff)

  await Promise.all(files.map(async file => {
    if (FileHelper.shouldExcludeFile(file.to)) return

    // Loop through every chunk in the file
    await Promise.all(file.chunks.map(async chunk => {
      // Chunks can have multiple changes
      await Promise.all(chunk.changes.map(async (change, index) => {

        if (change.type === "normal")
          return;

        const changedLine = change.ln;

        // Attempt to find a matching line: TODO Something something
        const matches = regex.exec(change.content)
        if (!matches || !matches.groups) return

        // Trim whitespace to ensure a clean title
        let title = matches.groups.title.trim()

        if (title.endsWith('-->')) {
          title = title.slice(0, title.length - 3)
          // TODO Add to regex :)
        }

        // This might have matched a minified file, or something huge.
        // GitHub wouldn't allow this anyway, so let's just ignore it.
        if (!title || title.length > 256) return

        // Get the details of this commit or PR
        const details = getDetails(chunk, changedLine)

        console.log(`Item found [${title}] in [${repoContext.full_name}]`)

        // Run the handler for this webhook listener
        todos.push({
          type: change.type,
          keyword: matches.groups.keyword,
          bodyComment: checkForBody(chunk.changes, index, matches.groups.beforeTag),
          filename: file.to,
          sha: process.env.GITHUB_SHA,
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
  changedLine: number
  title: string
  chunk: Chunk
  index: number
  labels: string[]
  similarTodo: Todo | undefined
  username: string
  assignedToString: string
  number: number | false
  issueId: number | false
  open: boolean | undefined
  range: string
}

module.exports = {
  generateTodosFromCommit,
}