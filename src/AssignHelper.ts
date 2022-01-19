import {argumentContext} from "./ArgumentContext";

const { reduceToList, addAt } = require('./helpers')

function generateAssignedTo (author: string, pr: number|boolean) {

  const autoAssign = argumentContext.autoAssign;

  if (autoAssign === false || !author)
    return ''

  if (autoAssign === true)
    return pr ? ` cc @${author}.` : ` It's been assigned to @${author} because they committed the code.`

  const assigner = reduceToList(autoAssign.map(user => addAt(user)))

  return pr ? ` cc ${assigner}` : ` It's been automagically assigned to ${assigner}.`
}

module.exports = {
  generateAssignedTo
}