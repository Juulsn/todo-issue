import resetModules = jest.resetModules;
import {context as github} from "@actions/github";

require('dotenv').config();

jest.mock("../src/TodoHandler")
jest.mock("../src/GitHubContext")

const {testTodoChange} = require("./helpers")
const context = require("../src/GitHubContext")

let existingIssues = [];

describe("Rename Test", () => {

    beforeEach(() => {
        resetModules()
        existingIssues = []
    })

    const test = (file, expects = {}) => testTodoChange("rename", file, expects);

    context.getIssues.mockImplementation(() => ({data: existingIssues}))

    it("Huge Rename", async () => {
        existingIssues.push({
            title: 'TODO should we reinvent the gear here??',
            number: 1,
            state: "open"
        })
        await test("HugeRename", {addTodo: 1, closeTodo: 1}) // well, thats the expected behavior, would be cool to track even such changes :) maybe by line index and let's say 50 % similarity?
    })

    it("Small Rename", async () => {
        existingIssues.push({
            title: 'TODO should we reinvent the gear here??',
            number: 8,
            state: "open"
        })
        await test("SmallRename", {updateTodo: 1})
    })

})