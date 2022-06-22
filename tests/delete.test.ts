// @ts-ignore
import {testTodoChange} from "./helpers";

import {config} from "dotenv";
import {addFakeIssue, clearFakeIssues} from "../src/TaskSystems/MockedTaskSystem";

config();

jest.mock("../src/TaskSystem")
jest.mock("../src/GitHubContext")

describe("Delete Test", () => {

    beforeEach(() => {
        jest.resetModules()
        clearFakeIssues()
    })

    const test = (file: string, expects = {}) => testTodoChange("delete", file, expects);

    it("Delete TODO", async () => {
        addFakeIssue({
            type: 'exists',
            title: 'a totally different TODO in the next Line',
            issueId: 2,
            open: true,
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