const fs = require('fs')
const path = require('path')
const gitContext = require("../src/GitHubContext");
const main = require("../src/ActionMain");
const todoHandler = require("../src/TodoHandler");

exports.testTodoChange = async (diffFolder: string, file: string, expects: any = {}) => {

    gitContext.getDiffFile.mockImplementationOnce(() => {
        return fs.readFileSync(path.join(__dirname, 'diffs', diffFolder, file + '.txt'), 'utf8');
    })

    await main();

    if (expects.addTodo !== false) expect(todoHandler.addTodo).toBeCalledTimes(expects.addTodo ? expects.addTodo : 0)
    if (expects.addReferenceTodo !== false) expect(todoHandler.addReferenceTodo).toBeCalledTimes(expects.addReferenceTodo ? expects.addReferenceTodo : 0)
    if (expects.reopenTodo !== false) expect(todoHandler.reopenTodo).toBeCalledTimes(expects.reopenTodo ? expects.reopenTodo : 0)
    if (expects.closeTodo !== false) expect(todoHandler.closeTodo).toBeCalledTimes(expects.closeTodo ? expects.closeTodo : 0)
    if (expects.updateTodo !== false) expect(todoHandler.updateTodo).toBeCalledTimes(expects.updateTodo ? expects.updateTodo : 0)
}