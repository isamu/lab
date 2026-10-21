import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { leadingLabelSpans } from "../packages/chaff/src/leading-label.ts";

// orthographic-variant: 同じ字でも別の語として書き分けるもの（人の「方」と比べる「ほう」、問答の（答）、〜とみられる）。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("orthographic-variant", source, ja).findings;

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("orthographic-variant: 人の「方」と比べる「ほう」", () => {
  it("人の「方」（担当の方）と、比べる「ほう」（早いほうが）を比べない", () => {
    assert.deepEqual(findingsOf("# 案内\n\n担当の方に伝えます。来場された方は受付へ。必要な方に届けます。早いほうがよい。\n"), []);
  });

  it("比べる「方が」と「ほうが」は今までどおり比べる", () => {
    assert.deepEqual(findingsOf("# 案内\n\n早いほうがよい。広いほうがよい。説明した方がよい。安いほうがよい。担当の方に伝えます。\n"), [
      "「方」と書いています（この文書はふつう「ほう」と書く語です。4 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("ほかの語のかなと漢字は今までどおり比べる", () => {
    assert.equal(findingsOf("# 案内\n\n窓口で申請できます。郵送でもできます。代理の人も申請出来ます。担当の方に伝えます。\n").length, 1);
  });
});

describe("orthographic-variant: 文の頭の印", () => {
  it("問答の（答）を、本文の「答え」と比べない", () => {
    assert.deepEqual(findingsOf("# 記録\n\n（答）未定です。\n\n（答）はい。\n\n（答）よいです。\n\n（問）答えは来週ですか。\n"), []);
  });

  it("文の中の「答」と「答え」は今までどおり比べる", () => {
    assert.equal(findingsOf("# 記録\n\n答えは三つ。答えを書く。答えを出す。正しい答を選ぶ。\n").length, 1);
  });

  it("印の範囲（文の頭の丸括弧に語を一つ）", () => {
    assert.deepEqual(leadingLabelSpans("（答）未定です。"), [{ start: 0, end: 3 }]);
    assert.deepEqual(leadingLabelSpans("　(注)別紙を見る。"), [{ start: 1, end: 4 }]);
    assert.deepEqual(leadingLabelSpans("（１）"), [{ start: 0, end: 3 }]);
  });

  it("印でないもの（文の途中、空白や句読点の入った括弧、長い括弧、閉じない括弧）", () => {
    assert.deepEqual(leadingLabelSpans("回答（答）です。"), []);
    assert.deepEqual(leadingLabelSpans("（答、問）"), []);
    assert.deepEqual(leadingLabelSpans("（質問への回答）"), []);
    assert.deepEqual(leadingLabelSpans("（答"), []);
    assert.deepEqual(leadingLabelSpans("（答！）"), []);
    assert.deepEqual(leadingLabelSpans("（「答」）"), []);
    assert.deepEqual(leadingLabelSpans(""), []);
  });
});

describe("orthographic-variant: 見立ての「みる」", () => {
  it("「〜ともみられる」「増加がみられる」を、目で見る「見る」と比べない", () => {
    assert.deepEqual(findingsOf("# 報告\n\n資料を見る。画面を見る。図を見た。回復は遅れるとみられる。\n"), []);
    assert.deepEqual(findingsOf("# 報告\n\n資料を見る。画面を見る。図を見た。増加がみられた。\n"), []);
  });

  it("見立てどうしは今までどおり比べる", () => {
    assert.equal(findingsOf("# 報告\n\n遅れるとみられる。増えるとみられる。減るとみられる。続くと見られる。\n").length, 1);
  });

  it("目で見る「見る」どうしは今までどおり比べる", () => {
    assert.equal(findingsOf("# 報告\n\n資料を見る。画面を見る。図を見た。表をみる。\n").length, 1);
    assert.equal(findingsOf("# 報告\n\n資料を見る。画面を見る。図を見た。映画をみられる。\n").length, 1);
  });
});

describe("orthographic-variant: 評価を言う「〜といえる」", () => {
  it("「〜とはいえない」を、「と」の付かない「言える」と比べない", () => {
    assert.deepEqual(findingsOf("# 報告\n\n一概には言えない。誰にも言えない。簡単には言えません。十分とはいえない。\n"), []);
    assert.deepEqual(findingsOf("# 報告\n\n嫌だと言えない。一概には言えない。十分とはいえない年齢だ。\n"), []);
  });

  it("「と」の後どうし、「と」の付かないものどうしは今までどおり比べる", () => {
    assert.equal(findingsOf("# 報告\n\n妥当といえる。正しいといえる。安全といえる。十分と言える。\n").length, 1);
    assert.equal(findingsOf("# 報告\n\n一概には言えない。誰にも言えない。簡単には言えません。誰にもいえない。\n").length, 1);
  });
});
