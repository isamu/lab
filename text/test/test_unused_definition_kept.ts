import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isNamedByHeading, isRejectedWording } from "../packages/chaff/src/detectors/unused-definition-kept.ts";

// unused-definition and terms that are not unused definitions: a wording quoted as what not to write (「X」とはせずに …),
// and a term a heading names under another capitalisation. A real unused definition beside them is still reported.
// Every text is self-written.

const RULE = "unused-definition";
const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter, "a.md", "docs/manual").findings;

const MARKERS = (ja.lexicons["rejected-wording"] ?? []).map((entry) => entry.pattern);

describe("isRejectedWording", () => {
  it("a quoted wording followed by a word that rejects it", () => {
    const source = "予報文では、「雨が強い」とはせずに、量を示す。";
    assert.equal(isRejectedWording(source, source.indexOf("「"), "雨が強い", MARKERS), true);
  });

  it("a definition, a missing term, and no word list", () => {
    const source = "「雨日数」とは、日降水量が一定以上の日の数をいう。";
    assert.equal(isRejectedWording(source, 0, "雨日数", MARKERS), false);
    assert.equal(isRejectedWording(source, 0, "無い語", MARKERS), false);
    assert.equal(isRejectedWording("「雨が強い」とはせずに", 0, "雨が強い", []), false);
  });
});

describe("isNamedByHeading", () => {
  it("a heading names the term under another capitalisation", () => {
    assert.equal(isNamedByHeading("Audio content", ["### Audio Content"]), true);
  });

  it("not a heading that only contains the term inside a word, nor no heading", () => {
    assert.equal(isNamedByHeading("audio", ["### Audiovisual"]), false);
    assert.equal(isNamedByHeading("audio", []), false);
  });
});

describe("unused-definition: wordings rejected and terms a heading names", () => {
  it("a wording quoted as what not to write is not reported; an unused definition beside it is", () => {
    const source = "# 予報の言い方\n\n予報文では、「雨が強い」とはせずに、量を示す。\n\n「降水日」とは、雨の降った日をいう。\n";
    assert.deepEqual(findingsOf(source), ["「降水日」を定義していますが、本文で使っていません"]);
  });

  it("a term a heading names with other capitals is not reported", () => {
    const source = "# Meetings\n\n### Video Content\n\n“Video content” refers to slides and shared screens. Follow these rules.\n";
    assert.deepEqual(findingsOf(source, en), []);
  });
});
