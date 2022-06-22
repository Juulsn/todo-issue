import {Todo} from "../Todo";
import {lineBreak} from "../Helpers";
import {template} from "../templates";
import {Octokit} from "@octokit/rest";
import {repoObject} from "../RepoContext";
import {Label} from "../LabelHelper";
import {ITaskSystem} from "../TaskSystem";
import {debug, error, notice} from "@actions/core";

const octokit = new Octokit({auth: process.env.GITHUB_TOKEN})

export class GitHubTaskSystem implements ITaskSystem {

    addTodo = async (todo: Todo): Promise<void> => {
        const body = lineBreak(template.issue(
            {
                ...repoObject,
                body: todo.bodyComment,
                ...todo
            })
        )

        notice(`Creating issue with title [${todo.title}] because of a comment`);

        const val = await octokit.issues.create({
            ...repoObject,
            title: todo.title,
            body,
            labels: todo.labels,
            assignees: todo.assignees
        })

        todo.issueId = val.data.number;

        await this.checkRateLimit();

        debug(`Issue [${todo.title}] got ID ${todo.issueId}`)
    };

    /**
     *
     * @param page
     * @returns Up to 100 issues at a time
     */
    getIssuesInPage = async (page: number) =>
        octokit.issues.listForRepo({
            ...repoObject,
            per_page: 100,
            state: "all",
            page
        })

    getTodos = async () => {
        const existingTodos: Todo[] = [];

        let page = 0;
        let next = true;

        while (next) {

            debug(`Requesting issues... page ${page}`)

            const result = await this.getIssuesInPage(page)

            next = result.data.length === 100;
            page++;

            await this.checkRateLimit()

            result.data.forEach((each) => {

                if (each.pull_request)
                    return

                debug(`Importing issue [#${each.number}]`)

                existingTodos.push(
                    {
                        type: "exists",
                        title: each.title,
                        //bodyComment: each.body,
                        issueId: each.number,
                        open: each.state === "open",
                        assignees: each.assignees?.map((assignee: any) => assignee.login) ?? []
                    } as Todo)
            })
        }

        return existingTodos;
    }

    existingLabels: string[] = [];

    ensureLabelExists = async (label: Label): Promise<void> => {

        if (this.existingLabels.includes(label.name))
            return

        try {
            await octokit.issues.createLabel(label)
        } catch {
            // Label already exists, ignore
        }

        this.existingLabels.push(label.name)
    }

    rateLimit = 0;

    checkRateLimit = async (decrease: boolean = true): Promise<void> => {

        if (this.rateLimit == 0) {

            let rate = await octokit.rateLimit.get();
            this.rateLimit = rate.data.rate.remaining

            if (rate.data.rate.remaining == 0) {
                const timeToWaitInMillis = (rate.data.rate.reset * 1000) - Date.now();
                debug(`Waiting ${timeToWaitInMillis / 1000} seconds because of githubs api rate limit`)
                await new Promise(resolve => setTimeout(resolve, timeToWaitInMillis))
            }

            rate = await octokit.rateLimit.get();
            this.rateLimit = rate.data.rate.remaining;
        }

        if (decrease)
            this.rateLimit--;

        return;
    }

    updateTodo = async (todo: Todo): Promise<void> => {

        if (!todo.issueId) {
            error(`Can't update issue [${todo.title}]! No issueId found`)
            return
        }

        notice(`Updating issue #${todo.issueId} because the title were changed`)

        await octokit.issues.update({
            ...repoObject,
            issue_number: todo.issueId,
            title: todo.title,
            // assignees will not get an update because it was probably just a typo fix
        })

        await this.checkRateLimit()
    }

    closeTodo = async (todo: Todo): Promise<void> => {

        if (!todo.issueId) {
            error(`Can't close issue [${todo.title}]! No issueId found`)
            return
        }

        const body = lineBreak(template.close(
            {
                ...repoObject,
                body: todo.bodyComment,
                ...todo
            })
        )

        notice(`Closing issue #${todo.issueId} because a comment with the title [${todo.title}] were removed`)

        await octokit.issues.createComment({
            ...repoObject,
            issue_number: todo.issueId,
            body,
        })

        await this.checkRateLimit();

        await octokit.issues.update({
            ...repoObject,
            issue_number: todo.issueId,
            state: 'closed'
        })

        await this.checkRateLimit();
    }

    reopenTodo = async (todo: Todo): Promise<void> => {

        if (!todo.issueId) {
            error(`Can't reopen issue [${todo.title}]! No issueId found`)
            return
        }

        notice(`Reopening issue #${todo.issueId} because there is a new issue with the same or a similar name`)

        await octokit.issues.update({
            ...repoObject,
            issue_number: todo.issueId,
            state: 'open'
        })

        await this.checkRateLimit();
    }

    updateAssignees = async (todo: Todo): Promise<void> => {

        if (!todo.assignees?.length) return
        if (!todo.issueId) return

        await octokit.issues.update({
            ...repoObject,
            issue_number: todo.issueId,
            assignees: todo.assignees,
        })

        await this.checkRateLimit();
    }

    addReferenceTodo = async (todo: Todo): Promise<void> => {

        const body = lineBreak(template.comment(
            {
                ...repoObject,
                body: todo.bodyComment,
                ...todo
            })
        )

        if (!todo.similarTodo?.issueId) {
            error(`Can't add reference for [${todo.title}] to issue [${todo.similarTodo?.title}]. No issueId found`)
            return
        }

        notice(`Adding a reference to the issue #${todo.similarTodo.issueId} with title [${todo.similarTodo?.title}] because it is similar to a the new issue [${todo.title}]`)

        await octokit.issues.createComment({
            ...repoObject,
            issue_number: todo.similarTodo.issueId,
            body
        })

        await this.checkRateLimit()

        await this.updateAssignees(todo.similarTodo)
    }

}