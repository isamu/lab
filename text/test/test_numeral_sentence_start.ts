import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { followsSentenceEnd, openingNumeral } from "../packages/chaff/src/detectors/numeral-opener.ts";

// 数字で始まる英語の文（numeral-sentence-start）。例文はすべて自作。

const RULE = "numeral-sentence-start";

const findingsOf = (source: string, adapter = en): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

describe("numeral-sentence-start: 数字で始まる英語の文", () => {
  it("数字で始まる文を言う", () => {
    assert.deepEqual(findingsOf("The meeting ran long. 20 people stayed for the vote.\n"), ['The sentence opens with the numeral "20"']);
    assert.deepEqual(openingNumeral("3,400 orders shipped in March."), "3,400");
    assert.deepEqual(openingNumeral("40% of users never open the menu."), "40%");
    assert.deepEqual(openingNumeral("2.5 hours passed before the reply."), "2.5");
  });

  it("年、番号の付いた題、時刻、言い終えていない行は言わない", () => {
    assert.equal(openingNumeral("2026 was a strong year for the team."), undefined);
    assert.equal(openingNumeral("1 Introduction"), undefined);
    assert.equal(openingNumeral("9:00 opening remarks."), undefined);
    assert.equal(openingNumeral("20 people"), undefined);
    assert.equal(openingNumeral("Twenty people stayed."), undefined);
    assert.equal(openingNumeral(""), undefined);
  });

  it("番号に付ける略した語や、句点の無い行の後ろの数は文の頭ではない", () => {
    const labels = new Set(["vol", "no", "fig"]);
    const at = (source: string): boolean => followsSentenceEnd(source, source.length, labels);
    assert.equal(at(""), true);
    assert.equal(at("# Results\n\n"), true);
    assert.equal(at("The meeting ran long. "), true);
    assert.equal(at("Sales rose in 2025. "), true);
    assert.equal(at("Communications of the ACM, vol. "), false);
    assert.equal(at("the version of H.R. "), false);
    assert.equal(at("Lane\n\n"), false);
    assert.equal(at("- Extreme cold\n\n"), false);
    assert.equal(at("It moved to Tokyo. "), true);
    assert.equal(at("See FIG. "), false);
    assert.equal(at("Filed as S. "), false);
    assert.deepEqual(findingsOf("Communications of the ACM, vol. 28 no. 10, pages 1-9.\n"), []);
    assert.deepEqual(findingsOf("Lane\n\n2 contains the intact product.\n"), []);
    assert.deepEqual(findingsOf("See Tbl. 20 for the retention schedule. See Subsec. 2 applies.\n"), []);
  });

  it("箇条書き、見出し、表、コードは読まない", () => {
    assert.deepEqual(findingsOf("# 3 reasons to switch\n\n- 3 items were left.\n\n| a |\n| - |\n| 5 rows were added. |\n"), []);
    assert.deepEqual(findingsOf("```\n20 people came.\n```\n"), []);
  });

  it("日本語の文書は読まない", () => {
    assert.deepEqual(findingsOf("20 人が来ました。\n", ja), []);
  });
});
