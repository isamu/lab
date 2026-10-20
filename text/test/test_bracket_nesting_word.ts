import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { withoutWordBrackets } from "../packages/chaff/src/bracket-annotation.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 語の一部として書いた括弧（読みの 拓（ひら）く、添え書きの 栄養教諭（仮称））は、括弧の重なりに数えない。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("bracket-nesting", source, ja, "a.md", "business/report").findings;

const annotations = ["仮称", "案"];

describe("bracket-nesting: 語の一部として書いた括弧", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("送り仮名や助詞が続く読みの括弧と、名前のすぐ後ろの添え書きを外す", () => {
    assert.equal(withoutWordBrackets("未来を拓（ひら）く力", annotations), "未来を拓く力");
    assert.equal(withoutWordBrackets("新しい係長（仮称）を置く", annotations), "新しい係長を置く");
    assert.equal(withoutWordBrackets("計画（案）と予算（仮称）", annotations), "計画と予算");
  });

  it("挟んだ言葉、前が空いた括弧、ひらがなの後ろの括弧、語彙表に無い添え書きは残す", () => {
    assert.equal(withoutWordBrackets("本文（氏名（ふりがな））を書く", annotations), "本文（氏名（ふりがな））を書く");
    assert.equal(withoutWordBrackets("これは （仮称） です", annotations), "これは （仮称） です");
    assert.equal(withoutWordBrackets("これは（たぶん）よい", annotations), "これは（たぶん）よい");
    assert.equal(withoutWordBrackets("報告（速報）を出す", annotations), "報告（速報）を出す");
  });

  it("引いた題名の中の読みと添え書きは重なりに数えず、本当に三重の括弧は指す", () => {
    assert.deepEqual(findingsOf("当会は「『未来を拓（ひら）く人を育てる』－新しい学びの形－」（答申）で提言した。\n"), []);
    assert.deepEqual(findingsOf("答申は「いわゆる『学習支援員（仮称）』の制度を設ける」と述べた。\n"), []);
    assert.equal(findingsOf("答申は「いわゆる『学習支援員（新設の職）』の制度を設ける」と述べた。\n").length, 1);
  });
});
