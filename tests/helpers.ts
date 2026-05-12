import fs from "fs";

import main from "../src/ActionMain";
import {getDiffFile} from "../src/GitHubContext";
import path from "path";
import {currentTaskSystem} from "../src/TaskSystem";

export async function testTodoChange(diffFolder: string, file: string, expects: any = {}) {

    // @ts-ignore
    getDiffFile.mockImplementationOnce(() => {
        return fs.readFileSync(path.join(__dirname, 'diffs', diffFolder, file + '.txt'), 'utf8');
    })

    await main();

    const current = currentTaskSystem();

    if (expects.addTodo !== false) expect(current.addTodo).toHaveBeenCalledTimes(expects.addTodo ? expects.addTodo : 0)
    if (expects.addReferenceTodo !== false) expect(current.addReferenceTodo).toHaveBeenCalledTimes(expects.addReferenceTodo ? expects.addReferenceTodo : 0)
    if (expects.reopenTodo !== false) expect(current.reopenTodo).toHaveBeenCalledTimes(expects.reopenTodo ? expects.reopenTodo : 0)
    if (expects.closeTodo !== false) expect(current.closeTodo).toHaveBeenCalledTimes(expects.closeTodo ? expects.closeTodo : 0)
    if (expects.updateTodo !== false) expect(current.updateTodo).toHaveBeenCalledTimes(expects.updateTodo ? expects.updateTodo : 0)
}