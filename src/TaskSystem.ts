import {Todo} from "./Todo";
import {Label} from "./LabelHelper";

let current: ITaskSystem;
export const setTaskSystem = (taskSystem: ITaskSystem) => {
    if(!current)
        current = taskSystem;
}
export const currentTaskSystem = () => current;

export interface ITaskSystem {
    checkRateLimit: (decrease: boolean) => Promise<void>
    getTodos: () => Promise<Todo[]>
    ensureLabelExists: (label: Label) => Promise<void>
    addTodo: (todo: Todo) => Promise<void>
    updateTodo: (todo: Todo) => Promise<void>
    closeTodo: (todo: Todo) => Promise<void>
    reopenTodo: (todo: Todo) => Promise<void>
    updateAssignees: (todo: Todo) => Promise<void>
    addReferenceTodo: (todo: Todo) => Promise<void>
}