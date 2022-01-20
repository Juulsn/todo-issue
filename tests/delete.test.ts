import resetModules = jest.resetModules;

require('dotenv').config();

jest.mock("../src/TodoHandler")
jest.mock("../src/GitHubContext")

const {testTodoChange} = require("./helpers")
const context = require("../src/GitHubContext")

let existingIssues: any[] = [];

describe("Delete Test", () => {

    beforeEach(() => {
        resetModules()
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