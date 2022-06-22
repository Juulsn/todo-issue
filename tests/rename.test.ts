import {config} from "dotenv";

config();

// @ts-ignore
import {testTodoChange} from "./helpers";
import {addFakeIssue, clearFakeIssues} from "../src/TaskSystems/MockedTaskSystem";

jest.mock("../src/TaskSystem")
jest.mock("../src/GitHubContext")

describe("Rename Test", () => {

    beforeEach(() => {
        jest.resetModules()
        clearFakeIssues()
    })

    const test = (file: string, expects = {}) => testTodoChange("rename", file, expects);

    it("Huge Rename", async () => {
        addFakeIssue({
            type: 'exists',
            title: 'TODO should we reinvent the gear here??',
            issueId: 1,
            open: true,
            assignees: []
        })
        await test("HugeRename", {addTodo: 1, closeTodo: 1}) // well, thats the expected behavior, would be cool to track even such changes :) maybe by line index and let's say 50 % similarity?
    })

    it("Small Rename", async () => {
        addFakeIssue({
            type: 'exists',
            title: 'TODO should we reinvent the gear here??',
            issueId: 8,
            open: true,
            assignees: []
        })
        await test("SmallRename", {updateTodo: 1})
    })

})