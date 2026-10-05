import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { paragraphEnd } from "../packages/chaff/src/detectors/missing-final-period.ts";

// 「。」で終わらない段落（missing-final-period）。例文はすべて自作。

const RULE = "missing-final-period";
const LEXICON = ja.lexicons["final-period"] ?? [];
const MARKS = {
  ends: LEXICON.filter((entry) => entry.group === "end").map((entry) => entry.pattern),
  otherEnds: LEXICON.filter((entry) => entry.group === "other-end").map((entry) => entry.pattern),
  notes: LEXICON.filter((entry) => entry.group === "note").map((entry) => entry.pattern),
};

const CLOSED = ["申請は市役所の窓口で受け付けます。", "受付の時間は平日の午前九時から午後五時までです。", "提出した書類は二週間ほどで審査が終わります。"];

/** A document of the closed paragraphs and then the given ones, one paragraph each. */
const documentWith = (...paragraphs: string[]): string => `${[...CLOSED, ...paragraphs].join("\n\n")}\n`;

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja).findings;

/** How each paragraph of a source ends: closed, open, or - when it is not counted. */
const formsOf = (source: string): readonly string[] => {
  const doc = buildDocument("a.md", source, ja);
  return doc.paragraphs.map((paragraph) => paragraphEnd(doc.prose ?? doc.source, paragraph, MARKS)?.form ?? "-");
};

describe("missing-final-period: 「。」で終わらない段落", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("「。」で終わる段落の多い文書で、述語で終わり「。」の無い段落を指す", () => {
    assert.deepEqual(findingsOf(documentWith("審査の結果は郵送でお知らせしました")), [
      "この段落は「。」で終わっていません（この文書の段落はふつう「。」で終わります。4 段落のうち 1 段落）",
    ]);
    assert.deepEqual(formsOf(documentWith("詳しい手順は担当者から説明します", "この方法が手続きとしていちばん望ましい")).slice(-2), ["open", "open"]);
  });

  it("閉じ括弧や引用で閉じた段落は閉じたものと数える", () => {
    assert.deepEqual(formsOf("担当者は「明日までに送ります。」\n\n係の人が「受付は終わりました」\n").slice(0, 2), ["closed", "closed"]);
  });

  it("文でない行は数えない", () => {
    assert.deepEqual(formsOf("受付時間"), ["-"]);
    assert.deepEqual(formsOf("申請に必要な書類は次のとおりです：\n"), ["-"]);
    assert.deepEqual(formsOf("※上記の目的のため、外部の業者に委託する場合がある\n"), ["-"]);
    assert.deepEqual(formsOf("ミニトマト　　　　三個を洗ってから半分に切る\n"), ["-"]);
    assert.deepEqual(formsOf("勤務地は東京で、将来は変更の可能性あり\n"), ["-"]);
    assert.deepEqual(formsOf("各アプリごとに以下の作業を毎月実施\n"), ["-"]);
    assert.deepEqual(formsOf("調理器具は使用後に洗いましょう。（詳しくは別の頁をご覧ください）\n"), ["-"]);
    assert.deepEqual(formsOf("手続きは窓口で確認します（詳しくは別紙を参照する）\n"), ["-"]);
    assert.deepEqual(formsOf("※申請は市役所の窓口で受け付けます。\n\n申請手数料　　千円を窓口で支払います。\n"), ["-", "-"]);
    assert.deepEqual(formsOf("申請は市役所の窓口で受け付けますか？\n\n受付の時間は平日の午前九時からです！\n"), ["-", "-"]);
  });

  it("「。」で終わらない段落の多い文書と、混ざりすぎた文書は指さない", () => {
    assert.deepEqual(findingsOf("審査の結果は郵送でお知らせしました\n\n詳しい手順は担当者から説明します\n\n申請は市役所の窓口で受け付けます。\n"), []);
    assert.deepEqual(findingsOf(documentWith("審査の結果は郵送でお知らせしました", "詳しい手順は担当者から説明します")), []);
  });

  it("話し言葉と文学では動かない", () => {
    const source = documentWith("審査の結果は郵送でお知らせしました");
    assert.equal(firedRules(ja, source, "business/report").includes(RULE), true);
    assert.equal(firedRules(ja, source, "speech/transcript").includes(RULE), false);
    assert.equal(firedRules(ja, source, "literature/essay").includes(RULE), false);
  });

  it("位置は段落の最後の字", () => {
    const last = "審査の結果は郵送でお知らせしました";
    const source = documentWith(last);
    const doc = buildDocument("a.md", source, ja);
    const paragraph = doc.paragraphs.at(-1);
    assert.ok(paragraph !== undefined);
    assert.equal(paragraphEnd(source, paragraph, MARKS)?.offset, source.indexOf(last) + last.length - 1);
  });
});
