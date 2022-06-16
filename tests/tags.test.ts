import {config} from "dotenv";

config();

jest.mock("../src/GitHubContext")

import {getLabels, defaultLabelCache} from "../src/LabelHelper";
import {splitTagsFromTitle} from "../src/TodoDetails";
import {argumentContext} from "../src/ArgumentContext";
describe("Tests Tags", () => {

    beforeEach(() => {
        // @ts-ignore
        defaultLabelCache = undefined;
    })

    it("find tags at the end", () => {
        const [title, tags] = splitTagsFromTitle("Create a new GITHUB issue [With This Tag] [And-this-Tag]");
        expect(title).toEqual("Create a new GITHUB issue");
        expect(tags.sort()).toEqual(['With This Tag', 'And-this-Tag'].sort())
    })

    it("find tags does not include tags from in between", () => {
        const [title, tags] = splitTagsFromTitle("Create a new [some note] GITHUB issue [Tag]");
        expect(title).toEqual("Create a new [some note] GITHUB issue");
        expect(tags).toEqual(['Tag'])
    })

    it("find tags does not remove same tag from in between if same tag on the end", () => {
        const [title, tags] = splitTagsFromTitle("Create a new [Tag] GITHUB issue [Tag]");
        expect(title).toEqual("Create a new [Tag] GITHUB issue");
        expect(tags).toEqual(['Tag'])
    })

    it("getLabels_TagGiven_ReturnGivenTag", async () => {
        let tags = await getLabels(['Tag']);
        expect(tags).toEqual(['Tag'])
    })

    it("getLabels_NoTagGiven_ReturnDefaultTag", async () => {
        argumentContext.label = true;

        let tags = await getLabels([]);
        expect(tags).toEqual(['todo :spiral_notepad:'])
    })

    it("getLabels_CustomDefaultTagsSet_ReturnCustomDefaultTags", async () => {
        argumentContext.label = ['my default tag', 'another tag']

        let tags = await getLabels([]);
        expect(tags).toEqual(['my default tag', 'another tag'])
    })

    it("getLabels_CustomDefaultTagsSetToFalse_ReturnNoTags", async () => {
        argumentContext.label = false;

        let tags = await getLabels([]);
        expect(tags).toEqual([])
    })
})