import {Todo} from "../Todo";
import {lineBreak} from "../Helpers";
import {template} from "../templates";
import {Octokit} from "@octokit/rest";
import {repoObject} from "../RepoContext";
import {Label} from "../LabelHelper";
import {ITaskSystem} from "../TaskSystem";
import {debug, error, info} from "@actions/core";

const octokit = new Octokit({auth: process.env.GITHUB_TOKEN})

export class GitHubTaskSystem implements ITaskSystem {

    /**
     *
     * @param page
     * @returns Up to 100 issues at a time
     */
    async getIssuesInPage(page: number) {
        return octokit.issues.listForRepo({
            ...repoObject,
            per_page: 100,
            state: "all",
            page
        })
    }

    async getTodos() {
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

    async ensureLabelExists(label: Label): Promise<void> {

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

    async checkRateLimit(decrease: boolean = true): Promise<void> {

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

    async addTodo(todo: Todo) {

        const body = lineBreak(template.issue(
            {
                ...repoObject,
                body: todo.bodyComment,
                ...todo
            })
        )

        info(`Creating issue with title [${todo.title}] because of a comment`)

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
    }

    async updateTodo(todo: Todo): Promise<void> {

        if (!todo.issueId) {
            error(`Can't update issue [${todo.title}]! No issueId found`)
            return
        }

        info(`Updating issue #${todo.issueId} because the title were changed`)

        await octokit.issues.update({
            ...repoObject,
            issue_number: todo.issueId,
            title: todo.title,
            // assignees will not get an update because it was probably just a typo fix
        })

        await this.checkRateLimit()
    }

    async closeTodo(todo: Todo): Promise<void> {

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

        info(`Closing issue #${todo.issueId} because a comment with the title [${todo.title}] were removed`)

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

    async reopenTodo(todo: Todo): Promise<void> {

        if (!todo.issueId) {
            error(`Can't reopen issue [${todo.title}]! No issueId found`)
            return
        }

        info(`Reopening issue #${todo.issueId} because there is a new issue with the same or a similar name`)

        await octokit.issues.update({
            ...repoObject,
            issue_number: todo.issueId,
            state: 'open'
        })

        await this.checkRateLimit();
    }

    async updateAssignees(todo: Todo): Promise<void> {

        if (!todo.assignees?.length) return
        if (!todo.issueId) return

        await octokit.issues.update({
            ...repoObject,
            issue_number: todo.issueId,
            assignees: todo.assignees,
        })

        await this.checkRateLimit();
    }

    async addReferenceTodo(todo: Todo): Promise<void> {

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

        info(`Adding a reference to the issue #${todo.similarTodo.issueId} with title [${todo.similarTodo?.title}] because it is similar to a the new issue [${todo.title}]`)

        await octokit.issues.createComment({
            ...repoObject,
            issue_number: todo.similarTodo.issueId,
            body
        })

        await this.checkRateLimit()

        await this.updateAssignees(todo.similarTodo)
    }

}