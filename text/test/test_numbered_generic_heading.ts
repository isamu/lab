import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { bareLabelPattern } from "../packages/chaff/src/detectors/generic-heading.ts";

// 札と番号だけの見出し（numbered-generic-heading）。例文はすべて自作。

const RULE = "numbered-generic-heading";

const findingsOf = (source: string, adapter = en): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const PATTERN = bareLabelPattern([{ pattern: "メリット" }, { pattern: "ポイント" }, { pattern: "Benefit" }, { pattern: "Key point" }]);

const isBare = (heading: string): boolean => PATTERN?.test(heading) ?? false;

describe("numbered-generic-heading: 札と番号だけの見出し", () => {
  it("札と番号だけの見出しが並ぶ文書を言う", () => {
    assert.deepEqual(findingsOf("# 新しい予約\n\n## メリット1\n\n空きが分かります。\n\n## メリット2\n\n取り消しが一度で済みます。\n", ja), [
      "見出し「メリット1」は札と番号だけで、節の中身が分かりません（そういう見出しが 2 個）",
      "見出し「メリット2」は札と番号だけで、節の中身が分かりません（そういう見出しが 2 個）",
    ]);
    assert.equal(findingsOf("# Booking\n\n## Benefit 1\n\nFree rooms.\n\n## Benefit 2\n\nOne-step cancel.\n").length, 2);
  });

  it("番号の書き方", () => {
    [
      "メリット1",
      "メリット 2",
      "メリット３",
      "メリット①",
      "メリットその1",
      "ポイント二",
      "ポイント1：",
      "Benefit #3",
      "benefit 4.",
      "Key point 2",
      "Benefit (2)",
      "メリット（3）",
    ].forEach((heading) => assert.equal(isBare(heading), true, heading));
  });

  it("題を足した見出し、手順、章の番号は言わない", () => {
    ["メリット1：設定が要らない", "Benefit 1: no setup", "ステップ1", "第1章", "メリット", "2つのメリット"].forEach((heading) =>
      assert.equal(isBare(heading), false, heading),
    );
    assert.deepEqual(findingsOf("# 予約\n\n## メリット1：空きが分かる\n\n本文です。\n\n## メリット2：取り消しが楽\n\n本文です。\n", ja), []);
  });

  it("一つだけなら言わない", () => {
    assert.deepEqual(findingsOf("# Booking\n\n## Benefit 1\n\nFree rooms.\n\n## Pricing\n\nFree.\n"), []);
  });

  it("札の無い語彙表", () => {
    assert.equal(bareLabelPattern([]), undefined);
  });
});
