import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { amountSlipsIn } from "../packages/chaff/src/detectors/amount-for-count.ts";

// 数えられる名詞の複数に付けた less（less-for-fewer）。例文はすべて自作。

const RULE = "less-for-fewer";

const findingsOf = (source: string, adapter = en): readonly string[] => namedRuleRun(RULE, `${source}\n`, adapter).findings;

describe("less-for-fewer: 数えられる名詞に less", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("数えられる名詞の複数の前の less を言う", () => {
    assert.deepEqual(findingsOf("The new parser reports less errors on long files."), ['"less errors" counts things; write "fewer errors"']);
    assert.deepEqual(findingsOf("We hired less people this quarter."), ['"less people" counts things; write "fewer people"']);
    assert.deepEqual(findingsOf("Less meetings would help the team."), ['"Less meetings" counts things; write "fewer meetings"']);
    assert.deepEqual(findingsOf("The plan needs far less steps. It ships with less approvals."), [
      '"less steps" counts things; write "fewer steps"',
      '"less approvals" counts things; write "fewer approvals"',
    ]);
  });

  it("単数の名詞を重ねた語の頭と、開き括弧の後ろも言う", () => {
    assert.deepEqual(findingsOf("We saw less customer complaints this quarter."), [
      '"less customer complaints" counts things; write "fewer customer complaints"',
    ]);
    assert.deepEqual(findingsOf("The summary says (less errors on long files)."), ['"less errors" counts things; write "fewer errors"']);
  });

  it("金額を言う複数は数えない", () => {
    assert.deepEqual(findingsOf("The division reported less earnings this quarter."), []);
    assert.deepEqual(findingsOf("We paid less fees after the change."), []);
  });

  it("量の名詞、形容詞に付く less、less than は言わない", () => {
    assert.deepEqual(findingsOf("The new parser takes less time and less memory."), []);
    assert.deepEqual(findingsOf("We hired less experienced staff this year."), []);
    assert.deepEqual(findingsOf("The job took less than five minutes."), []);
    assert.deepEqual(findingsOf("No less important things were raised."), []);
    assert.deepEqual(findingsOf("The tool stores less data than before."), []);
  });

  it("名詞や数の後ろの「引く」の less は言わない", () => {
    assert.deepEqual(findingsOf("Net income is revenue less costs."), []);
    assert.deepEqual(findingsOf("You will receive $500 less fees."), []);
  });

  it("名詞を重ねた語の途中の複数は言わない", () => {
    assert.deepEqual(findingsOf("The invoice shows less sales tax this month."), []);
  });

  it("コードの中と日本語の文書は読まない", () => {
    assert.deepEqual(findingsOf("Run `less errors.log` to read the file."), []);
    assert.deepEqual(findingsOf("新しい版では less errors になりました。", ja), []);
  });

  it("空の語の並びと語の無い語彙表", () => {
    const lists = { quantifiers: [{ pattern: "less", rewrite: "fewer" }], uncounted: new Set<string>(), finite: new Set<string>() };
    assert.deepEqual(amountSlipsIn("", [], lists), []);
    assert.deepEqual(amountSlipsIn("less errors", [], { ...lists, quantifiers: [] }), []);
  });
});
