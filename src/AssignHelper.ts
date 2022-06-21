import {argumentContext} from "./ArgumentContext";
import {addAt, reduceToList, stripAt} from "./Helpers";
import {prNr} from "./RepoContext";

export function generateAssignedTo(author: string, assignees: string[]) {

    const autoAssign = argumentContext.autoAssign;

    if (!assignees.length)
        return ''

    const assigner = reduceToList(assignees.map(user => addAt(user)))

    if (Array.isArray(autoAssign) ? autoAssign.sort().toString() === assignees.sort().toString() : false)
        return prNr ? ` cc ${assigner}` : ` It's been automagically assigned to ${assigner}.`

    if (autoAssign === true && [author].toString() === assignees.toString())
        return prNr ? ` cc @${assigner}.` : ` It's been assigned to ${assigner} because they committed the code.`

    return prNr ? ` cc ${assigner}` : ` It's been assigned to ${assigner} because they were mentioned in the comment.`
}

export function getMentionedAssignees(content: string, clipMentionedFromContent: boolean): [string, string[]] {

    const regex = new RegExp(`@[a-zA-Z\d@._-]+\\b`);

    const assignees = content.match(regex)?.map(value => stripAt(value)) ?? [];

    if (clipMentionedFromContent)
        content = content.replace(regex, "").trim()

    return [content, assignees];

}