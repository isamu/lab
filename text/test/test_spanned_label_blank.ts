import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSpannedLabelGap, isSpanningLabel } from "../packages/chaff/src/structure/spanned-label-blank.ts";

// 二つの列にまたがる行の見出しを、Markdown の表に変換して空いた升。例文はすべて自作。

const WORDS = ["Total", "Subtotal", "Sum", "合計", "小計", "計"];

describe("isSpanningLabel", () => {
  it("合計の語で始まるか終わる見出し、コロンで終わる見出しを見出しと読む", () => {
    [
      "Total",
      "Total score",
      'Total score (count of all "yes" answers above)',
      "Grand total",
      "**Subtotal**",
      "Owner:",
      "得点合計",
      "合計点",
      "担当：",
      "計",
    ].forEach((cell) => assert.equal(isSpanningLabel(cell, WORDS), true, cell));
  });

  it("合計の語が語の一部のもの、一文字の語で始まるか終わるだけのもの、空のものは見出しと読まない", () => {
    ["Totality", "Totalé", "Summary", "Subtotals", "Parking", "設計", "計画", "", "**", "(note)"].forEach((cell) =>
      assert.equal(isSpanningLabel(cell, WORDS), false, cell),
    );
    assert.equal(isSpanningLabel("Total", []), false);
  });
});

describe("isSpannedLabelGap", () => {
  it("見出しのすぐ後ろの空欄で、その後ろが埋まっていれば真", () => {
    assert.equal(isSpannedLabelGap(["Total score", undefined, "5", undefined], 1, WORDS), true);
    assert.equal(isSpannedLabelGap(["", "Total:", undefined, "5"], 2, WORDS), true);
  });

  it("空欄でない、後ろが空いている、前が見出しでない、前が無い、のどれかなら偽", () => {
    assert.equal(isSpannedLabelGap(["Total", "x", "5"], 1, WORDS), false);
    assert.equal(isSpannedLabelGap(["Total", undefined, undefined], 1, WORDS), false);
    assert.equal(isSpannedLabelGap(["Total", undefined], 1, WORDS), false);
    assert.equal(isSpannedLabelGap(["Parking", undefined, "5"], 1, WORDS), false);
    assert.equal(isSpannedLabelGap([undefined, undefined, "5"], 1, WORDS), false);
    assert.equal(isSpannedLabelGap([undefined, "5"], 0, WORDS), false);
  });
});
