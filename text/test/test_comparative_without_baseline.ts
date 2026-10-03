import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { bareComparativesIn, listsOf } from "../packages/chaff/src/detectors/bare-comparative.ts";

// 比べる相手の無い比較（comparative-without-baseline）。例文はすべて自作。

const RULE = "comparative-without-baseline";

const findingsOf = (source: string, adapter = en): readonly string[] => namedRuleRun(RULE, `${source}\n`, adapter).findings;

describe("comparative-without-baseline: 比べる相手の無い比較", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("日本語の、相手の無い「より」「さらに」を言う", () => {
    assert.deepEqual(findingsOf("新しい版では、処理がさらに高速になりました。", ja), ["「さらに高速」は、何と比べているかが書かれていません"]);
    assert.deepEqual(findingsOf("私たちはより良い結果を届けます。", ja), ["「より良い」は、何と比べているかが書かれていません"]);
  });

  it("英語の、節を閉じる比べた形を言う", () => {
    assert.deepEqual(findingsOf("We rewrote the parser. The new engine is faster."), ['"faster" does not say what it is compared with']);
    assert.deepEqual(findingsOf("The cache was rebuilt. Lookups are now much more efficient."), ['"more efficient" does not say what it is compared with']);
  });

  it("比べる相手が同じ文か直前の文にあれば言わない", () => {
    assert.deepEqual(findingsOf("従来より高速です。旧版に比べて、さらに高速になりました。", ja), []);
    assert.deepEqual(findingsOf("前回の版は遅いものでした。新しい版はさらに高速です。", ja), []);
    assert.deepEqual(findingsOf("The new engine is faster than version 2."), []);
    assert.deepEqual(findingsOf("The previous engine took a minute. The new one is faster."), []);
  });

  it("決まった言い方、名詞の前の比べた形、閉じない比較は言わない", () => {
    assert.deepEqual(findingsOf("より多くの人に届けます。より詳しくは付録を見てください。さらに、設定を保存します。", ja), []);
    assert.deepEqual(findingsOf("Get better results today. The engine runs faster on large files. The sooner the better."), []);
  });

  it("本日より（起点）と、語の一部の「より」は比較ではない", () => {
    assert.deepEqual(findingsOf("本日より受付を開始します。", ja), []);
    assert.deepEqual(findingsOf("学校・学年だより等で広く周知する。", ja), []);
  });

  it("語の無い文と語彙表", () => {
    assert.deepEqual(bareComparativesIn([], listsOf([])), []);
  });
});
