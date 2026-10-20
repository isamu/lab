import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 漢字の書き方が二つの語に読めるもの（行っ: いく・おこなう、様を: さま）は、解析器が選んだ読みのかなと比べない。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("orthographic-variant", source, ja, "a.md", "business/report").findings;

describe("orthographic-variant: 二つの語に読める漢字の書き方", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("「沿って行っている」の行っ（おこなう）は、補助動詞のいくと比べない", () => {
    const source = ["交渉は年ごとに広げていく。", "", "対象も段階的に増やしていく。", "", "交渉は方針に沿って行っている。", ""].join("\n");
    assert.deepEqual(findingsOf(source), []);
  });

  it("「〜する様を」の様（さま）は、〜のようにのようと比べない", () => {
    const source = ["次のように進める。", "", "前と同じように書く。", "", "例のように直す。", "", "人が集まる様を見て、名前を付けた。", ""].join("\n");
    assert.deepEqual(findingsOf(source), []);
  });

  it("「進めて行く」「この様な」は、これまでどおりかなと比べる", () => {
    const going = ["交渉は年ごとに広げていく。", "", "対象も段階的に増やしていく。", "", "改革を進めて行くこととした。", ""].join("\n");
    assert.equal(findingsOf(going).length, 1);
    const like = ["次のように進める。", "", "前と同じように書く。", "", "例のように直す。", "", "この様な形で書く。", ""].join("\n");
    assert.equal(findingsOf(like).length, 1);
  });

  it("解析器が「行う」と読んだ「行っ」は、おこなうのかなと比べる", () => {
    const conduct = ["調査を毎年おこなう。", "", "点検も毎月おこなう。", "", "昨年は交渉を行った。", ""].join("\n");
    assert.equal(findingsOf(conduct).length, 1);
  });
});
