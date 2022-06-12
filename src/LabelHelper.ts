import {config} from "dotenv";

config();

import {repoObject} from "./RepoContext";
import {argumentContext} from "./ArgumentContext";
import {ensureLabelExists} from "./GitHubContext";

export declare type Label = {
    owner: string,
    repo: string,
    name: string,
    color: string | undefined,
    request: { retries: number }
}

function createLabel(name: string, color: string | undefined = undefined): Label {
    return {
        ...repoObject,
        name,
        color,
        request: {retries: 0}
    }
}

export let defaultLabelCache: string[];

async function getDefaultLabels(): Promise<string[]> {

    if (defaultLabelCache)
        return defaultLabelCache;

    if (argumentContext.label === false)
        return defaultLabelCache = [];

    if (argumentContext.label === true) {
        const defaultLabel = createLabel('todo :spiral_notepad:', '00B0D8');

        await ensureLabelExists(defaultLabel);
        return defaultLabelCache = [defaultLabel.name]
    }

    for (let labelName of argumentContext.label)
        await ensureLabelExists(createLabel(labelName));

    return defaultLabelCache = argumentContext.label
}

export async function getLabels(tags: string[]): Promise<string[]> {

    if (!tags || tags.length === 0)
        return getDefaultLabels();

    for (const value of tags)
        await ensureLabelExists(createLabel(value));

    return tags;
}