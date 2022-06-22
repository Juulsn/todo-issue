import {Label} from "../LabelHelper";
import {ITaskSystem} from "../TaskSystem";
import {Todo} from "../Todo";
import {lineBreak} from "../Helpers";
import {template} from "../templates";
import {repoObject} from "../RepoContext";
import {debug, error, notice} from "@actions/core";

export class JiraTaskSystem implements ITaskSystem {
    addTodo = async (todo: Todo): Promise<void> => {
        // TODO add new todo
    };

    getTodos = async () => {
        const existingTodos: Todo[] = [];

        // TODO get labels

        return existingTodos;
    }

    existingLabels: string[] = [];
    ensureLabelExists = async (label: Label): Promise<void> => {

        if (this.existingLabels.includes(label.name))
            return

        try {
            // TODO create label
        } catch {
            // Label already exists, ignore
        }

        this.existingLabels.push(label.name)
    }

    rateLimit = 0;
    checkRateLimit = async (decrease: boolean = true): Promise<void> => {
        // TODO check rate limit
    }

    updateTodo = async (todo: Todo): Promise<void> => {
        // TODO update the title
    }

    closeTodo = async (todo: Todo): Promise<void> => {
        // TODO close the todo
    }

    reopenTodo = async (todo: Todo): Promise<void> => {
        // TODO reopen the todo
    }

    updateAssignees = async (todo: Todo): Promise<void> => {
        // TODO set assignees for todo
    }

    addReferenceTodo = async (todo: Todo): Promise<void> => {
        // TODO add a reference to another todo
    }
}
