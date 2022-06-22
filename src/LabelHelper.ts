import {repoObject} from "./RepoContext";
import {argumentContext} from "./ArgumentContext";
import {currentTaskSystem} from "./TaskSystem";

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

        await currentTaskSystem().ensureLabelExists(defaultLabel);
        return defaultLabelCache = [defaultLabel.name]
    }

    for (let labelName of argumentContext.label)
        await currentTaskSystem().ensureLabelExists(createLabel(labelName));

    return defaultLabelCache = argumentContext.label
}

export async function getLabels(tags: string[]): Promise<string[]> {

    if (!tags || tags.length === 0)
        return getDefaultLabels();

    for (const value of tags)
        await currentTaskSystem().ensureLabelExists(createLabel(value));

    return tags;
}