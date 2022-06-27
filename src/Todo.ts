import {Chunk, File} from "parse-diff";
import {argumentContext} from "./ArgumentContext";
import * as FileHelper from './FileHelper'
import {importEverything} from "./AllImporter";
import {checkForBody, getDetails, splitTagsFromTitle} from "./TodoDetails";
import {getLabels} from "./LabelHelper";
import {getDiffFile, getUsername} from "./GitHubContext";

import parseDiff from "parse-diff";
import {generateAssignedTo, getMentionedAssignees} from "./AssignHelper";

export async function generateTodosFromCommit() {

    const todos: Todo[] = []

    // RegEx that matches lines with the configured keywords
    const regex = new RegExp(`^(?<beforeTag>\\W+)(?<keyword>${argumentContext.keywords.join('|')})\\b\\S*(?<title>((?!-->).)+)`, (!argumentContext.caseSensitive ? 'i' : ''))

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

    await Promise.all(files.map(async file => {
        if (!file.to) return
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

                // GitHub wouldn't allow this, so let's ignore it.
                if (!title) return

                // Get the details of this commit or PR
                const details = getDetails(chunk, changedLine)

                let bodyComment: string | false = checkForBody(chunk.changes, index, matches.groups.beforeTag);

                const [newTitle, tags] = splitTagsFromTitle(title);

                title = newTitle;
                const labels: string[] = await getLabels(tags);

                // add assignees mentioned in title,
                // in the title we don't want anyone to get mentioned, so we save the mentioned ones but cut them out from the string
                const [titleWithoutMentionedAssignees, assigneesMentionedInTitle] = getMentionedAssignees(title, true);
                title = titleWithoutMentionedAssignees;
                assigneesMentionedInTitle.forEach(value => !details.assignees.includes(value) && details.assignees.push(value))

                // add assignees mentioned in comment body
                // here we don't care about them being still in the comment, so we will leave them there.
                if (bodyComment) {
                    const [, assigneesMentionedInBody] = getMentionedAssignees(bodyComment, false);
                    assigneesMentionedInBody.forEach(value => !details.assignees.includes(value) && details.assignees.push(value))
                }

                // Generate a string that expresses who the issue is assigned to
                const assignedToString = generateAssignedTo(getUsername(), details.assignees)

                if (title.length > 256) {

                    let wholeTitle = title + '<br><br>';

                    if (bodyComment)
                        bodyComment = wholeTitle + bodyComment
                    else
                        bodyComment = wholeTitle

                    title = title.slice(0, 100) + '...'
                }

                console.log(`Item found [${title}]`)

                todos.push({
                    type: change.type,
                    keyword: matches.groups.keyword,
                    filename: file.to,
                    escapedFilename: encodeURI(file.to as string),
                    sha: process.env.GITHUB_SHA,
                    assignedToString,
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
    issueId: number | false
    open: boolean | undefined
    range: string
}