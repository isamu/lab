import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// bracket-width-consistency on square brackets: a screen manual that names its buttons ［保存］ and, a few lines on, [保存].
// Every example is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
});

const RULE = "bracket-width-consistency";
const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja, "a.md", "docs/manual").findings;

const MANUAL = [
  "［申請書入力へ］をクリックしてください。",
  "［ブックマーク］をクリックすると登録できます。",
  "変更する場合は、[申請者情報を設定]をクリックしてください。",
  "",
].join("\n");

describe("bracket-width-consistency on square brackets", () => {
  it("points at the half-width square brackets when the full-width ones are usual", () => {
    assert.deepEqual(findingsOf(MANUAL), [
      "括弧を「[」と書いています（この文書はふつう「［」。6 箇所のうち 2 箇所が違う）",
      "括弧を「]」と書いています（この文書はふつう「］」。6 箇所のうち 2 箇所が違う）",
    ]);
  });

  it("compares square brackets apart from parentheses", () => {
    const source = "会議（定例）は月曜です。報告（月次）は金曜です。[保存]を押します。[戻る]を押します。\n";
    assert.deepEqual(findingsOf(source), []);
  });

  it("says nothing when one width is used throughout, or for Markdown links, footnotes and task boxes", () => {
    assert.deepEqual(findingsOf("[保存]を押します。[戻る]を押します。[閉じる]を押します。\n"), []);
    assert.deepEqual(findingsOf("［保存］を押します。詳しくは[設定の手順](https://example.com/a)を見てください。注がある[^1]。\n\n[^1]: 注の本文。\n"), []);
    assert.deepEqual(findingsOf("［保存］を押します。［戻る］を押します。\n\n- [ ] 未完了の項目\n- [x] 完了した項目\n"), []);
  });
});
