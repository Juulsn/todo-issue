import {Octokit} from "@octokit/rest";
const repoContext = require("./RepoContext");
import {argumentContext} from "./ArgumentContext";

module.exports = async function getLabels(context: Octokit) {

    if (argumentContext.label === false)
        return [];

    if (argumentContext.label === true) {

        const newLabel = {
            repo: repoContext.repo, owner: repoContext.owner,
            name: 'todo :spiral_notepad:',
            color: '00B0D8',
            request: {retries: 0},
        };

        try {
            await context.issues.createLabel(newLabel)
        } catch (e) {
            // Label already exists, ignore
        }

        return [newLabel.name]
    } else
        return argumentContext.label
}