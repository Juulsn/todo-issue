import {argumentContext} from "../src/ArgumentContext";
import {checkSimilarity} from "../src/Helpers";
import {Todo} from "../src/Todo";
import {config} from "dotenv";
// @ts-ignore
import {testTodoChange} from "./helpers";
import {currentTaskSystem, setTaskSystem} from "../src/TaskSystem";
import {GitHubTaskSystem} from "../src/TaskSystems/GithubTaskSystem";
import {addFakeIssue, clearFakeIssues} from "../src/TaskSystems/MockedTaskSystem";

config();

jest.mock("../src/TaskSystem")
jest.mock("../src/GitHubContext")

describe("Add Test", () => {

    beforeEach(() => {
        jest.resetModules()
        clearFakeIssues();
    })

    setTaskSystem(new GitHubTaskSystem());
    const taskSystem = (currentTaskSystem() as any);

    const test = (file: string, expects = {}) => testTodoChange("add", file, expects);

    it("Adds One Todo", async () => {
        await test("Add", {addTodo: 1})
    })

    it("Adds Body", async () => {
        await test("AddBody")
    })

    it("Does not add BUG", async () => {
        await test("AddBUG")
    })

    it("Adds BUG", async () => {
        argumentContext.keywords = ['TODO', 'BUG']
        await test("AddBUG", {addTodo: 1})
    })

    it("Adds One TODO in HTML", async () => {

        taskSystem.addTodo.mockImplementationOnce((todo: Todo) => {
            expect(todo.title.endsWith('-->')).toBeFalsy()
        })

        await test("AddInHtml", {addTodo: 1})
    })

    it("Adds Many Different", async () => {
        await test("AddMany", {addTodo: 5})
    })

    it("Adds TODO with similar title as existing", async () => {
        addFakeIssue({
            title: 'should we reinvent the gear here??',
            number: 2,
            open: true,
            assignees: []
        })

        taskSystem.addReferenceTodo.mockImplementationOnce((todo: Todo) => {
            expect(todo.similarTodo?.issueId).toBeCloseTo(2)
        })

        await test("AddSecond", {addReferenceTodo: 1})
    })

    it("Adds TODO with similar title as closed existing", async () => {
        addFakeIssue({
            title: 'should we reinvent the gear here??',
            number: 2,
            type: "exists",
            open: false,
            assignees: [{login: 'DerJuulsn'}]
        })

        taskSystem.addReferenceTodo.mockImplementationOnce((todo: Todo) => {
            expect(todo.similarTodo?.issueId).toBeCloseTo(2)
            expect(todo.similarTodo?.assignees).toContainEqual('DerJuulsn')
            expect(todo.similarTodo?.assignees).toContainEqual('TestUser')
        })

        await test("AddSecond", {addReferenceTodo: 1, reopenTodo: 1})
    })

    it("Adds Three Same TODOs", async () => {
        await test("AddThreeSame", {addTodo: 1, addReferenceTodo: 2})
    })

    it("Adds Two similar TODOs", async () => {
        await test("AddTwoSimilar", {addTodo: 1, addReferenceTodo: 1})
    })

    it("Adds Two similar TODOs with existing", async () => {
        addFakeIssue({
            title: 'should we reinvent the gear here..',
            number: 3,
            type: "exists",
            open: false,
            assignees: []
        })
        await test("AddTwoSimilar", {addReferenceTodo: 2, reopenTodo: 1})
    })

    it("Adds TODO with body", async () => {

        taskSystem.addTodo.mockImplementationOnce((todo: Todo) => {
            expect(todo.bodyComment).toHaveLength(531)
            expect(todo.assignees).toContainEqual('TestUser')
        })

        await test("AddTodoWithBody", {addTodo: 1})
    })

    it("Adds two TODOs in two lines", async () => {
        await test("AddTwoInTwoLines", {addTodo: 2})
    })

    it("Add all", async () => {
        const added: any[] = []

        taskSystem.addTodo.mockImplementation((todo: Todo) => {
            expect(added.find(value => checkSimilarity(value.title, todo.title))).toBeUndefined()
            added.push(todo)
        })

        taskSystem.addReferenceTodo.mockImplementation((todo: Todo) => {
            expect(added.find(value => checkSimilarity(value.title, todo.title))).toBeDefined()
        })

        await test("All", {addTodo: false, addReferenceTodo: false})
    })
})