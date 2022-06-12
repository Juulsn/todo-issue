import github from '@actions/github';
import {getInput} from 'action-input-parser';

export const argumentContext = {

    keywords: getInput('keywords', {type: 'array', default: ['TODO']}) as Array<string>,
    bodyKeywords: getInput('bodyKeywords', {type: 'array', default: []}) as Array<string>,

    caseSensitive: getInput('caseSensitive', {type: "boolean", default: true}) as boolean,

    titleSimilarity: getInput("taskSystem", {
        type: "number",
        disableable: true,
        default: 80
    }) as number | false,

    label: getInput('label', {type: "array", disableable: true, default: true}) as Array<string> | boolean,
    blobLines: getInput('blobLines', {type: "number", default: 5, disableable: true}) as number | false,
    blobLinesBefore: getInput('blobLinesBefore', {type: "number", default: 0}) as number,
    autoAssign: getInput('autoAssign', {
        type: "array",
        disableable: true,
        default: true
    }) as Array<string> | boolean,

    excludePattern: getInput('excludePattern', {type: 'string'}) as string,

    taskSystem: getInput("taskSystem", {type: "string", default: "GitHub"}) as string,

    importAll: github?.context?.payload?.inputs?.importAll as boolean,

    reopenClosed: getInput("reopenClosed", {type: "boolean", default: true}) as boolean

};