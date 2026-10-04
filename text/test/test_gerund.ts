import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gerundFeatures } from "../packages/lang-en/src/gerund.ts";

const DICTIONARY: Readonly<Record<string, readonly string[]>> = {
  heading: ["VBG", "NN"],
  missing: ["VBG", "JJ", "NN"],
  emerging: ["VBG"],
  existing: ["VBG", "JJ"],
};
const tagsOf = (word: string): readonly string[] | undefined => DICTIONARY[word];

describe("gerundFeatures", () => {
  it("名詞にはなるが形容詞にはならない -ing 形は、名詞句の頭にもなる", () => {
    assert.deepEqual(gerundFeatures("heading", tagsOf), { VerbForm: "Ger", AlsoNoun: "Yes" });
    assert.deepEqual(gerundFeatures("Heading", tagsOf), { VerbForm: "Ger", AlsoNoun: "Yes" });
  });

  it("形容詞にもなる語、名詞にならない語、辞書に無い語は、修飾語のまま", () => {
    ["missing", "emerging", "existing", "zxqving", ""].forEach((word) => assert.deepEqual(gerundFeatures(word, tagsOf), { VerbForm: "Ger" }, word));
  });
});
