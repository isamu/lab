import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 疑問の「か」で終わる文（どのような見直しが必要か。）は問いで、名詞で止めた文ではない。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("taigen-dome-in-prose", source, ja, "a.md", "business", "strict").findings;

describe("taigen-dome-in-prose: 疑問の「か」で終わる文", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("「〜が必要か。」と問う文は数えない", () => {
    const questions = ["研修の進め方にはどのような見直しが必要か。", "教材の配り方についてどのような支援が必要か。", "評価の方法としてどの形が適切か。", ""];
    assert.deepEqual(findingsOf(questions.join("\n")), []);
  });

  it("名詞で止めた文は、問いと並んでいても数える", () => {
    const clipped = ["今年の目標は売上の回復。", "そのための施策は三つ。", "最初は店頭の品ぞろえの見直し。", "どのような支援が必要か。", ""];
    assert.equal(findingsOf(clipped.join("\n")).length, 1);
  });
});
