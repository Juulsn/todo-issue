import {checkSimilarity} from "../src/Helpers";

describe('Test Similarity', () => {
    it('returns similar', function () {
        expect(checkSimilarity("some text!", "some text!")).toBeTruthy()
        expect(checkSimilarity("some text!", "some text??")).toBeTruthy()
        expect(checkSimilarity("Title with number 3", "Title without number 3!")).toBeTruthy()
    })

    it('returns not similar', function () {
        expect(checkSimilarity("some text!", "some text???")).toBeFalsy()
        expect(checkSimilarity("some text", "a totally different text")).toBeFalsy()
    })
});