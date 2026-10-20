import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 願いや目的の中の比較（より広く進めたい、より円滑にするためには）は、今の状態と比べている。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("comparative-without-baseline", source, ja, "a.md", "business/proposal").findings;

describe("comparative-without-baseline: 願いや目的の中の比較", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("願い（たい）、目的（ため）、目当て（図る、目指す、べき）の中の比較は指さない", () => {
    assert.deepEqual(findingsOf("資料の公開をより広く進めることで、地域に役立ちたい。\n"), []);
    assert.deepEqual(findingsOf("授業と実習をより円滑につなぐためには、何を見直せばよいか。\n"), []);
    assert.deepEqual(findingsOf("窓口の対応をより丁寧に行うことを図る。\n"), []);
    assert.deepEqual(findingsOf("手続きはより簡素に整えるべきである。\n"), []);
  });

  it("変わったことを言うだけの比較と、動かせることを言う比較は、これまでどおり指す", () => {
    assert.equal(findingsOf("新しい版では、処理がさらに高速になりました。\n").length, 1);
    assert.equal(findingsOf("新しい版では、処理をより速く動かせます。\n").length, 1);
    assert.equal(findingsOf("新しい版では、処理がより速くなりました。\n").length, 1);
    // 理由の「ため」は目的ではない。
    assert.equal(findingsOf("処理がより速くなったため、待ち時間が減った。\n").length, 1);
    assert.equal(findingsOf("この版には、さらに安全な書き方があるため、古い関数は使わない。\n").length, 1);
  });
});
