import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// weasel-word: a phrase that names its source is not lent to an unnamed crowd. Every example is self-written.

const findingsOf = (source: string, adapter = en, genre = "blog/tech"): readonly string[] =>
  namedRuleRun("weasel-word", `${source}\n`, adapter, "a.md", genre).findings;

describe("weasel-word: a phrase that names its source", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("valid: a citation later in the sentence says which studies", () => {
    assert.deepEqual(
      findingsOf("# Notes\n\nOur results agree with earlier studies showing that teams ship faster with short reviews [3, 7].", en, "academic/paper"),
      [],
    );
    assert.deepEqual(findingsOf("# Notes\n\nStudies show that short reviews help (Lee, 2019)."), []);
  });

  it("valid: a reference list's entry is the cited work's own words", () => {
    const source = "# Notes\n\nShort reviews help [1].\n\n## References\n\n- [1] A. Lee (2024) Short code reviews pay off, experts say. Note: Example News.";
    assert.deepEqual(findingsOf(source), []);
  });

  it("invalid: with no citation, the phrase still credits no one", () => {
    assert.equal(findingsOf("# Notes\n\nStudies show that short reviews help.").length, 1);
    assert.equal(findingsOf("# Notes\n\nExperts say short reviews help. Lee found the same [1].").length, 1);
  });

  it("valid: 「先方からは「…」と言われています」は言った人を名指している", () => {
    assert.deepEqual(findingsOf("# 報告\n\n先方からは「担当がいないと進まないのか」と言われています。", ja, "business/proposal"), []);
    assert.deepEqual(findingsOf("# 報告\n\n現場からも「手順が多い」と言われている。", ja, "business/proposal"), []);
  });

  it("invalid: 名指しの無い引用は、これまでどおり指す", () => {
    assert.equal(findingsOf("# 報告\n\n「早起きは得だ」と言われている。", ja, "business/proposal").length, 1);
  });
});
