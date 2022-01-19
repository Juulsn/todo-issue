import {Todo} from "./Todo";
import {checkSimilarity} from "./helpers";

function cleanUpTodos(found: Todo[], existing: Todo[]) {

    // Set IssueID for existing found Todos
    found.forEach(foundTodo => {
        const todos = existing.filter(value => foundTodo.title === value.title);

        if (!todos.length)
            return

        if (todos.length > 1)
            console.warn(`More than one possible issue for TODO ${foundTodo.title} in file ${foundTodo.filename} line ${foundTodo.changedLine} found, using first.`)

        console.log(`${foundTodo.title} has exactly the same title as existing todo ${todos[0]}`)

        foundTodo.issueId = todos[0].issueId;
    })

    // Moved and small changes TODOs
    found.forEach(todo0 => {
        found.forEach(todo1 => {

            if (todo0.type !== "del" || todo1.type !== "add") return;

            if (todo0.title === todo1.title) {
                // hier gehen wir davon aus, dass der comment nur verschoben wurde
                todo0.type = "ignore";
                todo1.type = "ignore";
                return;
            }

            // zwei verschiedene todos

            if (!checkSimilarity(todo0.title, todo1.title)) return;

            // hier gehen wir davon aus, dass ein typo gefixt wurde. → todo1 auf "update" setzen
            todo1.type = "update"
            // altes to_do sollte dann aber nicht geschlossen werden
            todo0.type = "ignore"

            const existingTodo = existing.find(value => value.issueId == todo0.issueId)

            if (!existingTodo) {
                console.error("No matching issue found!")
                return;
            }

            // issueId übertragen, um das updaten einfach zu machen (alle "update" haben somit eine IssueId)
            todo1.issueId = existingTodo.issueId;

            // existingTodo hat ab hier den neuen Title
            existingTodo.title = todo1.title;
        })
    })

    found.forEach(value => {
        if (value.type !== "del") return

        //open hier direkt auf false setzen statt type auf ignore, da ein neuer (ähnlicher) comment hinzugefügt werden könnte der dann nicht neu erstellt wird, sondern referenziert
        const existingTodo = existing.find(each => each.issueId === value.issueId);
        if (existingTodo) existingTodo.open = false
    })

    found = found.filter(value => value.type !== "ignore")

    let groupList = []

    // Group similar TODOs
    found.forEach(foundTodo0 => {
        if (foundTodo0.type !== "add")
            return

        groupList.push([foundTodo0])

        groupList.forEach(group => {
            group.forEach(foundTodo1 => {
                if (!group.includes(foundTodo0) && checkSimilarity(foundTodo0.title, foundTodo1.title)) {
                    group.push(foundTodo0)
                }
            })
        })

        // found.forEach(foundTodo1 => {
        //     if (foundTodo1.type !== "add")
        //         return
        //
        //     if (checkSimilarity(foundTodo0.title, foundTodo1.title)) {
        //         groupList.push([foundTodo0, foundTodo1])
        //     }
        // })
    })

    // Merge all groups which includes the same TODOs
    groupList.forEach(group0 => {

        // has similarity
        const group = groupList.find(group1 => group1 !== group0 && group1.some(todo => group0.includes(todo)))

        if (group) {
            //merge group0 into group1 and remove group0 from groupList
            group0.filter(value => !group.includes(value)).forEach(val => group.push(val))
            groupList = groupList.filter(value => value !== group0);
        }
    })

    // Now search for a parent for each group
    groupList.forEach(group => {
        const parent = existing.find(existingTodo => group.some(todo => checkSimilarity(todo.title, existingTodo.title))) ?? group[0]

        if(parent.type === "exists"){
            if (!parent.open) {
                // überprüfen, ob ein to_do das Schließen gerade wollte. Wenn ja, dann nicht schließen anfordern
                const changedTodo = found.find(each => each.issueId && each.issueId === parent.issueId);
                if (changedTodo && changedTodo.type == "del") {
                    changedTodo.type = "ignore";
                    parent.open = true
                }
            }
        }

        group.forEach(todo => {
            if(todo === parent) return
            todo.similarTodo = parent;
            todo.type = "addReference"
        })
    })

    return found;
}

module.exports = {
    cleanUpTodos
}