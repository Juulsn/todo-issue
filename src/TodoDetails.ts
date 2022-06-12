import {Change, Chunk} from "parse-diff";
import {argumentContext} from "./ArgumentContext";
import {assignFlow, escapeForRegExp, lineBreak} from "./helpers";
import {prNr} from "./RepoContext";
import {getUsername} from "./GitHubContext";
import {generateAssignedTo} from "./AssignHelper";


/**
 * Get the file boundaries of the hunk
 */
export function getFileBoundaries(changes: any[], line: number, paddingTop = 0, paddingBottom = 2) {

    let firstChange = changes[0]
    let lastChange = changes[changes.length - 1]

    const firstChangedLine = firstChange.ln || firstChange.ln2;
    const lastChangedLine = lastChange.ln || lastChange.ln2;

    let start;
    if (line == firstChangedLine) {
        start = Math.max(1, line - paddingTop);
    } else {
        start = Math.max(line - paddingTop, firstChangedLine)
    }

    // we dont know the actual lines count of the file, so we cant add something like minPadding (at least for the bottom)
    let end = Math.min(line + paddingBottom, lastChangedLine)

    return {start, end}
}

/**
 * Prepares some details about the TO_DO
 */
export function checkForBody(changes: Change[], changeIndex: number, beforeTag: string) {
    const bodyPieces = []
    const nextChanges = changes.slice(changeIndex + 1)

    const BODY_REG = new RegExp(`${escapeForRegExp(beforeTag)}\\W*(?<keyword>${argumentContext.bodyKeywords.join('|')})\\b\\W*(?<body>.*)`, !argumentContext.caseSensitive ? 'i' : '')

    for (const change of nextChanges) {
        const matches = BODY_REG.exec(change.content)

        if (!matches) break

        if (!matches.groups?.body) {
            bodyPieces.push('\n')
        } else {
            if (bodyPieces.length > 0 && bodyPieces[bodyPieces.length - 1] !== '\n') bodyPieces.push(' ')
            bodyPieces.push(lineBreak(matches.groups.body).trim())
        }
    }

    return bodyPieces.length ? bodyPieces.join('') : false
}

export function splitTagsFromTitle(title: string): string[] {

    if (!title)
        return [];

    const getMatch = () => {
        return title.match(new RegExp(`\\[([^\\]]+)]$`));
    }

    const tags: string[] = [];

    let match = getMatch();

    while (match) {
        tags.push(match[1].trim());
        title = title.replace(match[0], "").trimEnd();
        match = getMatch();
    }

    return tags;
}

export function getDetails(chunk: Chunk, line: number) {

    const username = getUsername()

    // Generate a string that expresses who the issue is assigned to
    const assignedToString = generateAssignedTo(username, prNr)

    const assignees = assignFlow(username);

    let range: false | string
    if (!argumentContext.blobLines) {
        // Don't show the blob
        range = false
    } else {
        const {
            start,
            end
        } = getFileBoundaries(chunk.changes, line, argumentContext.blobLinesBefore, argumentContext.blobLines)
        range = start === end ? `L${start}` : `L${start}-L${end}`
    }

    return {
        username,
        assignedToString,
        number: prNr,
        range,
        assignees
    }
}