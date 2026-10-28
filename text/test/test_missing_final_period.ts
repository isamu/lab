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
  labels: LEXICON.filter((entry) => entry.group === "label").map((entry) => entry.pattern),
};

const CLOSED = ["申請は市役所の窓口で受け付けます。", "受付の時間は平日の午前九時から午後五時までです。", "提出した書類は二週間ほどで審査が終わります。"];

/** A document of the closed paragraphs and then the given ones, one paragraph each. */
const documentWith = (...paragraphs: string[]): string => `${[...CLOSED, ...paragraphs].join("\n\n")}\n`;

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja).findings;

/** How each paragraph of a source ends: closed, open, or - when it is not counted. */
const formsOf = (source: string): readonly string[] => {
  const doc = buildDocument("a.md", source, ja);
  return doc.paragraphs.map(
    (paragraph, index) => paragraphEnd(doc.prose ?? doc.source, paragraph, MARKS, doc.paragraphs[index + 1], doc.paragraphs[index - 1])?.form ?? "-",
  );
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

  it("●などの印で始まる一行の段落は、下に文が続けば小見出しなので数えない", () => {
    const heading = "●1人で作業しないで声をかけ合うようにする";
    const prose = "熱中症の事故の多くは、1人で作業しているときに起きています。";
    assert.deepEqual(formsOf(`${heading}\n\n${prose}\n`), ["-", "closed"]);
    assert.deepEqual(findingsOf(documentWith(heading, prose)), []);
    // 印の無い一行、印で始まっても二行ある段落、後ろに何も無い一行は、これまでどおり数える。
    assert.deepEqual(formsOf(`1人で作業しないで声をかけ合うようにする\n\n${prose}\n`)[0], "open");
    assert.deepEqual(formsOf("●作業の前に確認する。\n申請は市役所の窓口で受け付けます\n"), ["open"]);
    assert.deepEqual(formsOf(`${heading}\n`), ["open"]);
    // 印が行の途中にあれば小見出しではない。
    assert.deepEqual(formsOf(`作業の前には●の欄を必ず確認するようにする\n\n${prose}\n`)[0], "open");
    // 印で始まる文が並ぶのは文の箇条で、「。」の有無を数える。
    assert.deepEqual(formsOf("●申請書は市役所の窓口で受け付けます\n\n●受付の時間は平日の午前九時から午後五時までです。\n"), ["open", "closed"]);
    assert.deepEqual(formsOf(`●申請書は市役所の窓口で受け付けます。\n\n${prose}\n`)[0], "closed");
  });

  it("定義の箇条の説明（語の下の「:入力した内容をプレビューできます」）は文として数えない", () => {
    const list = ["プレビュー", ":入力した内容をプレビューできます"];
    assert.deepEqual(formsOf(`${list.join("\n\n")}\n`), ["-", "-"]);
    assert.deepEqual(formsOf("続紙追加\n\n：申請書に続紙を追加して入力できます\n")[1], "-");
    assert.deepEqual(findingsOf(documentWith(...list)), []);
    // 行の途中のコロン、二つ続くコロン、コロンの無い説明は、これまでどおり数える。
    assert.deepEqual(formsOf("ボタン:入力した内容をプレビューできます\n"), ["open"]);
    assert.deepEqual(formsOf("::入力した内容をプレビューできます\n"), ["open"]);
    // 語の下でなく、文の段落の後ろや文書の頭に置いた「:」の段落は、説明ではないので数える。
    assert.deepEqual(formsOf("申請は市役所の窓口で受け付けます。\n\n:重要な申請は窓口で受け付けます\n"), ["closed", "open"]);
    assert.deepEqual(formsOf(":重要な申請は窓口で受け付けます\n"), ["open"]);
    // 一つの語に説明が二つ続くときは、二つ目も説明。
    assert.deepEqual(formsOf("プレビュー\n\n:入力した内容をプレビューできます\n\n:印刷する前の内容も確かめられます\n"), ["-", "-", "-"]);
    assert.deepEqual(findingsOf(documentWith("プレビュー", "入力した内容をプレビューできます")), [
      "この段落は「。」で終わっていません（この文書の段落はふつう「。」で終わります。4 段落のうち 1 段落）",
    ]);
  });

  it("繰り返す型に置いた一行（見出しの下の要約、語と説明の語、続けて書いた項目）は、どれも「。」が無ければ数えない", () => {
    // 「。」で閉じた段落を多めに置き、閉じていない二つが少ないほうに入るようにする。
    const prose = [...CLOSED, ...CLOSED].join("\n\n");
    const summaries = ["窓口で申請の書類をまとめて受け付ける", "書類の中身を担当者が一つずつ確かめる", "審査の結果を後日郵送でお知らせする"];
    const step = (line: string, index: number): string => ["## 手順" + String(index + 1), line, "### 例", "- 窓口"].join("\n\n");
    const underHeadings = (lines: readonly string[]): string => ["# 手続き", prose, ...lines.map(step)].join("\n\n") + "\n";
    assert.deepEqual(findingsOf(underHeadings(summaries)), []);
    // 一つでも「。」で閉じた要約があれば型ではなく、閉じていないほうを数える。二つしか無ければ型と見ない。
    assert.equal(findingsOf(underHeadings([...summaries.slice(0, 2), `${summaries[2]}。`])).length, 2);
    assert.equal(findingsOf(underHeadings(summaries.slice(0, 2))).length, 2);

    const terms = ["住所が変わって手続きが分からない", "書類を書くのがむずかしいと感じる", "窓口に行く時間がなかなか取れない"];
    const explained = terms.flatMap((term) => [term, "担当者が電話で手続きを一緒に確かめます。"]);
    assert.deepEqual(findingsOf(documentWith(...CLOSED, ...explained)), []);
    assert.equal(findingsOf(documentWith(...CLOSED, ...explained.slice(0, 4))).length, 2);

    const items = ["（1）窓口で申請の書類を受け付けます", "（2）書類の中身を担当者が確かめます", "（3）審査の結果を郵送でお知らせします"];
    assert.deepEqual(findingsOf(`${prose}\n\n${items.join("\n")}\n`), []);
    const closedLast = [...items.slice(0, 2), items[2] + "。"].join("\n");
    assert.equal(findingsOf(`${prose}\n\n${closedLast}\n`).length, 2);
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
