const {argumentContext} = require("./ArgumentContext");
const levenshtein = require('js-levenshtein');

export function reduceToList(array: string[]) {
    return array.reduce((prev, value, i) => {
        if (i + 1 === array.length) {
            return prev + ` and ${value}`
        } else if (i === 0) {
            return prev + `${value}`
        } else {
            return prev + `, ${value}`
        }
    }, '')
}

export function addAt(str: string) {
    if (!str.startsWith('@')) return `@${str}`
    return str
}

export function stripAt(str: string) {
    if (str.startsWith('@')) return str.split('@')[1]
    return str
}

export function assignFlow(author: string) : string[] {
    if (argumentContext.autoAssign === true) {
        if(author)
            return [author]
        return []
    } else if (argumentContext.autoAssign) {
        return argumentContext.autoAssign.map((n: string) => stripAt(n))
    }
    return []
}

export function lineBreak(body: string) {
    const regEx = /\/?&lt;br(?:\s\/)?&gt;/g // Regular expression to match all occurences of '&lt;br&gt'
    return body.replace(regEx, '<br>')
}

export function escapeForRegExp(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function checkSimilarity(title0: string, title1: string) {

    // TODO Extend config for issue merge?
    // wenn das to_do einen sehr ähnlichen Titel hat, aber evtl nicht in der selben Datei steht
    // kann er entweder zusammen gefasst werden (wenn der Titel länger als z.B. 15 zeichen ist?)
    // oder der Titel kürzer ist und somit nicht aussagekräftig genug ist um es in dasselbe Issue zu stecken
    // -> fürs erste gehen wir mal davon aus so oft wie möglich zu mergen

    return (argumentContext.titleSimilarity && levenshtein(title0, title1) <= ((title0.length + title1.length) / 2) * (1 - argumentContext.titleSimilarity / 100))
}