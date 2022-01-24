const github = require('@actions/github');
const inputParser = require('action-input-parser');

export const argumentContext = {

    keywords: inputParser.getInput('keywords', {type: 'array', default: ['TODO']}) as Array<string>,
    bodyKeywords: inputParser.getInput('bodyKeywords', {type: 'array', default: []}) as Array<string>,

    caseSensitive: inputParser.getInput('label', {type: "boolean", default: true}) as boolean,

    titleSimilarity: inputParser.getInput("taskSystem", {
        type: "number",
        disableable: true,
        default: 80
    }) as number | false,

    label: inputParser.getInput('label', {type: "array", disableable: true, default: true}) as Array<string> | boolean,
    blobLines: inputParser.getInput('blobLines', {type: "number", default: 5, disableable: true}) as number | false,
    autoAssign: inputParser.getInput('autoAssign', {
        type: "array",
        disableable: true,
        default: true
    }) as Array<string> | boolean,

    excludePattern: inputParser.getInput('excludePattern', {type: 'string'}) as string,

    taskSystem: inputParser.getInput("taskSystem", {type: "string", default: "GitHub"}) as string,

    importAll: github?.context?.payload?.inputs?.importAll as boolean,

    reopenClosed: inputParser.getInput("reopenClosed", {type: "boolean", default: true}) as boolean

};