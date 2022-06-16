import {config} from "dotenv";

config();

jest.mock("../src/GitHubContext")

import {getMentionedAssignees, generateAssignedTo} from "../src/AssignHelper";
import {argumentContext} from "../src/ArgumentContext";
import {assignFlow} from "../src/helpers";

describe("Tests Tags", () => {

    it("find and strip assignees", () => {
        const [title, assignees] = getMentionedAssignees("Create a new GITHUB issue @DerJuulsn", true);
        expect(title).toEqual("Create a new GITHUB issue");
        expect(assignees).toEqual(['DerJuulsn'])
    })

    it("find and do not strip assignees", () => {
        const [title, assignees] = getMentionedAssignees("Create a new GITHUB issue @DerJuulsn", false);
        expect(title).toEqual("Create a new GITHUB issue @DerJuulsn");
        expect(assignees).toEqual(['DerJuulsn'])
    })

    it("test arguments_autoAssignFalse_noAssignees", () => {
        argumentContext.autoAssign = false;
        const assignees = assignFlow("DerJuulsn");
        expect(assignees).toEqual([])
    })

    it("test arguments_autoAssignTrue_AssignAuthor", () => {
        argumentContext.autoAssign = true;
        const assignees = assignFlow("DerJuulsn");
        expect(assignees).toEqual(['DerJuulsn'])
    })

    it("test arguments_autoAssignSetToUser_AssignUser", () => {
        argumentContext.autoAssign = ['User'];
        const assignees = assignFlow("DerJuulsn");
        expect(assignees).toEqual(['User'])
    })

    it("generateAssignedTo_autoAssignFalse_noAssignee", () => {
        argumentContext.autoAssign = false;
        const s = generateAssignedTo("DerJuulsn", []);
        expect(s).toEqual('')
    })

    it("generateAssignedTo_autoAssignFalse AuthorAssignee_authorMentioned", () => {
        argumentContext.autoAssign = false;
        const s = generateAssignedTo("DerJuulsn", ['DerJuulsn']);
        expect(s).toEqual(' It\'s been assigned to @DerJuulsn because they were mentioned in the comment.')
    })

    it("generateAssignedTo_autoAssignTrue AuthorAssignee_authorHasCommitted", () => {
        argumentContext.autoAssign = true;
        const s = generateAssignedTo("DerJuulsn", ['DerJuulsn']);
        expect(s).toEqual(' It\'s been assigned to @DerJuulsn because they committed the code.')
    })

    it("generateAssignedTo_autoAssignTrue MultipleAssignees_MultipleAssigneesWereMentioned", () => {
        argumentContext.autoAssign = true;
        const s = generateAssignedTo("DerJuulsn", ["User1", "User2"]);
        expect(s).toEqual(' It\'s been assigned to @User1 and @User2 because they were mentioned in the comment.')
    })

    it("generateAssignedTo_autoAssignIsCustomUser_CustomUserAutomagically", () => {
        argumentContext.autoAssign = ["CustomUser"];
        const s = generateAssignedTo("DerJuulsn", ["CustomUser"]);
        expect(s).toEqual(' It\'s been automagically assigned to @CustomUser.')
    })

    it("generateAssignedTo_autoAssignIsAuthor_AuthorCommited", () => {
        argumentContext.autoAssign = ["DerJuulsn"];
        const s = generateAssignedTo("DerJuulsn", ["DerJuulsn"]);
        expect(s).toEqual(' It\'s been automagically assigned to @DerJuulsn.')
    })
})