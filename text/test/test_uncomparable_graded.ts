import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// Uncomparable adjectives given a degree (uncomparable-graded). Every example is self-written.

const RULE = "uncomparable-graded";

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, en).findings;

describe("uncomparable-graded: a degree on an adjective that has none", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("reports a grade before an uncomparable adjective", () => {
    assert.deepEqual(findingsOf("The design is very unique."), ['"very unique" grades an adjective that has no degrees']);
    assert.deepEqual(findingsOf("This vote was more unanimous than the last."), ['"more unanimous" grades an adjective that has no degrees']);
    assert.deepEqual(findingsOf("A fix by Friday is Extremely impossible."), ['"extremely impossible" grades an adjective that has no degrees']);
  });

  it("leaves the bare adjective, words of closeness and adjectives that have degrees alone", () => {
    assert.deepEqual(findingsOf("The design is unique."), []);
    assert.deepEqual(findingsOf("The design is almost unique, and a fix is nearly impossible."), []);
    assert.deepEqual(findingsOf("The design is very unusual and more complete."), []);
    assert.deepEqual(findingsOf("Each key is unique. More keys follow."), []);
  });

  it("every lexicon phrase is found in a sentence", () => {
    const lexicon = en.lexicons[RULE] ?? [];
    assert.ok(lexicon.length > 0);
    lexicon.forEach((entry) => assert.equal(findingsOf(`The result is ${entry.pattern}.`).length, 1, entry.pattern));
  });

  it("does not run on literature", () => {
    const source = "The design is very unique.\n";
    assert.ok(firedRules(en, source, "business/report").includes(RULE));
    assert.ok(!firedRules(en, source, "literature/fiction").includes(RULE));
  });
});

const japaneseFindingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, ja).findings;

describe("uncomparable-graded in Japanese: より最適, とても完璧", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("reports a grade before 最適, 最善 or 完璧", () => {
    assert.deepEqual(japaneseFindingsOf("より最適な案を選びました。"), ["「より最適な」は、程度の無い語に程度を付けています"]);
    assert.deepEqual(japaneseFindingsOf("仕上がりはとても完璧でした。"), ["「とても完璧」は、程度の無い語に程度を付けています"]);
    assert.deepEqual(japaneseFindingsOf("前の版より最善の方法です。"), ["「より最善」は、程度の無い語に程度を付けています"]);
  });

  it("leaves the bare word, closeness, より meaning by, and より最適化 alone", () => {
    assert.deepEqual(japaneseFindingsOf("最適な案を選びました。仕上がりは完璧でした。"), []);
    assert.deepEqual(japaneseFindingsOf("仕上がりはほぼ完璧でした。"), []);
    assert.deepEqual(japaneseFindingsOf("データにより最適な設定を選びます。"), []);
    assert.deepEqual(japaneseFindingsOf("処理をより最適化しました。"), []);
    assert.deepEqual(japaneseFindingsOf("最も最適な案を選びました。"), []);
  });

  it("every lexicon phrase is found in a sentence", () => {
    const lexicon = ja.lexicons[RULE] ?? [];
    assert.ok(lexicon.length > 0);
    lexicon.forEach((entry) => assert.equal(japaneseFindingsOf(`結果は${entry.pattern}ものでした。`).length, 1, entry.pattern));
  });

  it("does not run on literature", () => {
    const source = "より最適な案を選びました。\n";
    assert.ok(firedRules(ja, source, "business/report").includes(RULE));
    assert.ok(!firedRules(ja, source, "literature/fiction").includes(RULE));
  });
});
