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

  it("副詞を挟んだ more も言い、一字の相手の語は語の頭だけで読む", () => {
    assert.deepEqual(findingsOf("We rewrote the stage. The pipeline is more computationally efficient."), [
      '"more computationally efficient" does not say what it is compared with',
    ]);
    assert.deepEqual(findingsOf("障害から復旧しました。新しい版はさらに高速です。", ja), ["「さらに高速」は、何と比べているかが書かれていません"]);
  });

  it("比べる相手が同じ文か前の二文にあれば言わない", () => {
    assert.deepEqual(findingsOf("従来方式では誤検出が多くありました。今回は閾値を調整しました。より高い精度で判定します。", ja), []);
    assert.deepEqual(findingsOf("従来より高速です。旧版に比べて、さらに高速になりました。", ja), []);
    assert.deepEqual(findingsOf("前回の版は遅いものでした。新しい版はさらに高速です。", ja), []);
    assert.deepEqual(findingsOf("The new engine is faster than version 2."), []);
    assert.deepEqual(findingsOf("The previous engine took a minute. The new one is faster."), []);
  });

  it("決まった言い方、名詞の前の比べた形、閉じない比較は言わない", () => {
    assert.deepEqual(findingsOf("より多くの人に届けます。より詳しくは付録を見てください。さらに、設定を保存します。", ja), []);
    assert.deepEqual(findingsOf("Get better results today. The engine runs faster on large files. The sooner the better."), []);
    assert.deepEqual(findingsOf("The model had better, more predictable results."), []);
  });

  it("条件か仮定の下の比較は、その条件の無い場合と比べている", () => {
    assert.deepEqual(findingsOf("視点をもう少し入れるとより良くなる。filter メソッドを使えばより簡潔に書けます。", ja), []);
    assert.deepEqual(findingsOf("Lists can be written as a paragraph if it looks better. We share it even when hiding it would be easier."), []);
    assert.deepEqual(findingsOf("Ending the partnership may be more appropriate."), []);
    assert.deepEqual(findingsOf("AとBはさらに高速です。", ja), ["「さらに高速」は、何と比べているかが書かれていません"]);
  });

  it("語に分かれた相手の語（これ・まで、で・は・なく）と、位置を言う「さらに上」", () => {
    assert.deepEqual(findingsOf("これまでは手間がかかったが、手続きがさらに簡単になった。", ja), []);
    assert.deepEqual(findingsOf("単なる支障ではなく、より重い支障がある場合に限る。", ja), []);
    assert.deepEqual(findingsOf("state を共通の親のさらに上に置く。", ja), []);
  });

  it("鉤括弧の中の比較は、題や語を挙げたもの", () => {
    assert.deepEqual(findingsOf("詳しくは「申告がさらに簡単に！」のページを見てください。", ja), []);
    assert.deepEqual(findingsOf("詳しくは、申告がさらに簡単になったことを見てください。", ja), ["「さらに簡単」は、何と比べているかが書かれていません"]);
  });

  it("本日より（起点）と、語の一部の「より」は比較ではない", () => {
    assert.deepEqual(findingsOf("本日より受付を開始します。", ja), []);
    assert.deepEqual(findingsOf("学校・学年だより等で広く周知する。", ja), []);
  });

  it("語の無い文と語彙表", () => {
    assert.deepEqual(bareComparativesIn([], listsOf([])), []);
  });
});
