import {config} from "dotenv";

// @ts-ignore
import {testTodoChange} from "./helpers";
import {addFakeIssue, clearFakeIssues} from "../src/TaskSystems/MockedTaskSystem";

config();

jest.mock("../src/TaskSystem")
jest.mock("../src/GitHubContext")

describe("Other TODO Change Tests", () => {

    beforeEach(() => {
        jest.resetModules()
        clearFakeIssues()
    })

    const test = (file: string, expects = {}) => testTodoChange("other", file, expects);

    it("Move TODO", async () => {
        addFakeIssue({
            title: 'TODO should we reinvent the gear here?? üäö',
            number: 241,
            open: true,
            assignees: []
        })
        await test("MoveComment")
    })

    it("Change without TODO", async () => {
        await test("None")
    })

    it("Reformat before TODO Tag", async () => {
        await test("ReformatBeforeTag")
    })

    it("Add TODO without Title", async () => {
        await test("TitleWithWhitespace")
    })
})