// @ts-ignore
import {testTodoChange} from "./helpers";

import {config} from "dotenv";
config();

const context = require("../src/GitHubContext")

jest.mock("../src/TodoHandler")
jest.mock("../src/GitHubContext")

let existingIssues: any[] = [];

describe("Delete Test", () => {

    beforeEach(() => {
        jest.resetModules()
        existingIssues = []
    })

    const test = (file: string, expects = {}) => testTodoChange("delete", file, expects);

    context.getIssues.mockImplementation(() => ({data: existingIssues}))

    it("Delete TODO", async () => {
        existingIssues.push({
            title: 'a totally different TODO in the next Line',
            number: 2,
            state: "open",
            assignees: []
        })
        await test("Delete", {closeTodo: 1})
    })

    it("Delete TODO, not existing", async () => {
        await test("Delete", {closeTodo: 1})
    })

    it("Delete Body", async () => {
        await test("DeleteBody")
    })

})