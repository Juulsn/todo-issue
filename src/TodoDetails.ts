import {Change, Chunk} from "parse-diff";
import {argumentContext} from "./ArgumentContext";
import {escapeForRegExp} from "./helpers";

const repoContext = require("./RepoContext");
const {getUsername} = require("./GitHubContext");

const {lineBreak} = require('./helpers')
const {generateAssignedTo} = require('./AssignHelper')

/**
 * Get the file boundaries of the hunk
 */
function getFileBoundaries(lastChange, line: number, padding = 2) {
  const end = Math.min(line + padding, lastChange.ln || lastChange.ln2)
  return {start: line, end}
}

/**
 * Prepares some details about the TODO
 */
function checkForBody(changes: Change[], changeIndex: number, beforeTag: string) {
  const bodyPieces = []
  const nextChanges = changes.slice(changeIndex + 1)

  const BODY_REG = new RegExp(`${escapeForRegExp(beforeTag)}\\W*(?<keyword>${argumentContext.bodyKeywords.join('|')})\\b\\W*(?<body>.*)`, !argumentContext.caseSensitive ? 'i' : '')

  for (const change of nextChanges) {
    const matches = BODY_REG.exec(change.content)

    if (!matches) break

    if (!matches.groups.body) {
      bodyPieces.push('\n')
    } else {
      if (bodyPieces.length > 0 && bodyPieces[bodyPieces.length - 1] !== '\n') bodyPieces.push(' ')
      bodyPieces.push(lineBreak(matches.groups.body).trim())
    }
  }

  return bodyPieces.length ? bodyPieces.join('') : false
}

function getDetails(chunk: Chunk, line: number) {

  const number = repoContext.isPr ? repoContext.pull_number : false

  const username = getUsername()

  // Generate a string that expresses who the issue is assigned to
  const assignedToString = generateAssignedTo(username, number)

  let range: false | string
  if (!argumentContext.blobLines) {
    // Don't show the blob
    range = false
  } else {
    const lastChange = chunk.changes[chunk.changes.length - 1]
    const {start, end} = getFileBoundaries(lastChange, line, argumentContext.blobLines)
    range = start === end ? `L${start}` : `L${start}-L${end}`
  }

  return {
    username,
    assignedToString,
    number,
    range
  }
}

module.exports = {
  getFileBoundaries,
  checkForBody,
  getDetails
}