import {Todo} from "../Todo";
import {Label} from "../LabelHelper";
import {ITaskSystem} from "../TaskSystem";

let existingIssues: Todo[] = [];

export function clearFakeIssues() {
    existingIssues = [];
}

export function addFakeIssue(todo: any) {
    existingIssues.push(todo)
}

export class MockedTaskSystem implements ITaskSystem {
    checkRateLimit: (decrease: boolean) => Promise<void> = jest.fn();
    getTodos: () => Promise<Todo[]> = jest.fn().mockImplementation(() => existingIssues);
    ensureLabelExists: (label: Label) => Promise<void> = jest.fn();
    addTodo: (todo: Todo) => Promise<void> = jest.fn();
    updateTodo: (todo: Todo) => Promise<void> = jest.fn();
    closeTodo: (todo: Todo) => Promise<void> = jest.fn();
    reopenTodo: (todo: Todo) => Promise<void> = jest.fn();
    updateAssignees: (todo: Todo) => Promise<void> = jest.fn();
    addReferenceTodo: (todo: Todo) => Promise<void> = jest.fn();
}