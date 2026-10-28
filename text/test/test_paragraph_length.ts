import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { isTooLongParagraph, labelledBlocks, opensWithFusedHeading } from "../packages/chaff/src/paragraph-length.ts";
import { contractionExtraWords } from "../packages/chaff/src/contraction-words.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const RULE = "max-paragraph-length";

const findingsOf = (source: string, adapter: LanguageAdapter, genre: string, limits: Readonly<Record<string, number>> = {}): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre, limits)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.values["count"]));

const fullSentenceOf = (language: string): number | undefined => loadRules(language).find((rule) => rule.id === RULE)?.full_sentence;

describe("isTooLongParagraph: more sentences than the limit, and longer than that many full sentences", () => {
  it("reports a paragraph over both limits", () => {
    assert.equal(isTooLongParagraph([20, 20, 20, 20, 20, 20], 5, 18), true);
  });

  it("does not report many short sentences: their total is under the length", () => {
    assert.equal(isTooLongParagraph([4, 4, 4, 4, 4, 4, 4, 4, 4, 4], 5, 18), false);
  });

  it("does not report a long paragraph of few sentences: that is the sentence rule's to report", () => {
    assert.equal(isTooLongParagraph([60, 60, 60, 60, 60], 5, 18), false);
  });

  it("the length limit is exclusive, like the sentence limit", () => {
    assert.equal(isTooLongParagraph([15, 15, 15, 15, 15, 15], 5, 18), false);
    assert.equal(isTooLongParagraph([15, 15, 15, 15, 15, 16], 5, 18), true);
    assert.equal(isTooLongParagraph([50, 50, 50, 50, 50], 5, 18), false);
  });

  it("scales the length with the sentence limit, so a team's number moves both", () => {
    const sizes = [20, 20, 20, 20, 20, 20, 20, 20, 20];
    assert.equal(isTooLongParagraph(sizes, 5, 18), true);
    assert.equal(isTooLongParagraph(sizes, 8, 18), true);
    assert.equal(isTooLongParagraph(sizes, 9, 18), false);
    assert.equal(isTooLongParagraph([20, 20, 20, 20, 20, 20, 20, 20, 20, 20], 9, 25), false);
  });

  it("without a full-sentence length, counts sentences alone", () => {
    assert.equal(isTooLongParagraph([1, 1, 1, 1, 1, 1], 5, undefined), true);
    assert.equal(isTooLongParagraph([1, 1, 1, 1, 1], 5, undefined), false);
    assert.equal(isTooLongParagraph([0, 0, 0, 0, 0, 0], 5, undefined), true);
  });

  it("an empty paragraph is never too long", () => {
    assert.equal(isTooLongParagraph([], 0, 18), false);
    assert.equal(isTooLongParagraph([], 5, undefined), false);
  });
});

describe("max-paragraph-length: the full-sentence length is data, per language", () => {
  it("both languages declare one, in their own unit", () => {
    assert.equal(typeof fullSentenceOf("ja"), "number");
    assert.equal(typeof fullSentenceOf("en"), "number");
    assert.ok((fullSentenceOf("ja") ?? 0) > (fullSentenceOf("en") ?? 0), "characters outnumber words");
  });
});

// NASA Knows! (Grades K-4): What Is a Spacewalk? Public domain (NASA). Seven short sentences, 88 words.
const NASA_AIRLOCK = [
  "Astronauts are now ready to get out of their spacecraft. They leave the spacecraft through a special door called an airlock.",
  "The airlock has two doors. When astronauts are inside the spacecraft, the airlock is airtight so no air can get out.",
  "When astronauts get ready to go on a spacewalk, they go through the first door and lock it tight behind them.",
  "They can then open the second door without any air getting out of the spacecraft. After a spacewalk, astronauts go back inside through the airlock.",
].join(" ");

// Minutes of the Federal Open Market Committee, July 2025. Public domain (Federal Reserve Board). Six dense sentences.
const FOMC_LABOR = [
  "Recent data indicated that labor market conditions remained solid. The unemployment rate was 4.1 percent in June, down 0.1 percentage point from May.",
  "The participation rate edged down 0.1 percentage point in June, and the employment-to-population ratio was unchanged.",
  "Total nonfarm payroll gains were solid in June, though the pace of private payroll gains stepped down noticeably.",
  "The ratio of job vacancies to unemployed workers was 1.1 in June and remained within the narrow range seen over the past year.",
  "Average hourly earnings for all employees rose 3.7 percent over the 12 months ending in June, slightly lower than the year-earlier pace.",
].join(" ");

describe("max-paragraph-length (English)", () => {
  it("valid: a children's paragraph of short sentences is not a wall", () => {
    assert.deepEqual(findingsOf(`# Spacewalks\n\n${NASA_AIRLOCK}\n`, en, "blog/owned-media"), []);
  });

  it("invalid: a dense paragraph of long sentences is still reported, with its sentence count", () => {
    assert.deepEqual(findingsOf(`# Labor market\n\n${FOMC_LABOR}\n`, en, "business/meeting-notes"), ["6"]);
  });

  it("a team's lower limit reaches the short paragraph too", () => {
    assert.deepEqual(findingsOf(`# Spacewalks\n\n${NASA_AIRLOCK}\n`, en, "blog/owned-media", { [RULE]: 3 }), ["7"]);
  });
});

describe("contractionExtraWords: the words a contraction stands for beyond the one written", () => {
  const cases: readonly (readonly [string, number])[] = [
    ["Don't write for a class.", 1],
    ["Don’t write. It’s late. You’re right, we’ve said it, I’ll go, I’m here, I'd stay.", 7],
    ["They can't and won't.", 2],
    ["That's true; let's go; there's one.", 3],
    ["The audience's level and the company’s plan.", 0],
    ["Rock 'n' roll at o'clock with O'Donnell.", 0],
    ["Do not write for a class.", 0],
    ["I'd've gone; Iʼm here; Élan’t is not a word but counts.", 4],
    ["", 0],
  ];
  cases.forEach(([text, extra]) => {
    it(`${JSON.stringify(text)} has ${String(extra)}`, () => assert.equal(contractionExtraWords(text), extra));
  });
});

// Self-written: seven sentences that sit at the length limit, with two contractions.
const AT_THE_LIMIT = [
  "Many writers believe that plain language means writing for a reader who knows nothing about the subject at hand.",
  "That's not what it means.",
  "Plain language means writing for the readers you actually have, with the words they already use every day.",
  "Think about what your readers already know before you start.",
  "Don't explain the basics to a room full of specialists who work with them all the time.",
  "Explain them only when your readers are new to it.",
  "Ask a colleague who knows your readers to read the draft.",
].join(" ");

describe("max-paragraph-length: expanding a contraction does not change the length", () => {
  it("reports the paragraph the same with Don't and with Do not", () => {
    const contracted = findingsOf(`# Plain language\n\n${AT_THE_LIMIT}\n`, en, "blog/owned-media");
    const expanded = findingsOf(`# Plain language\n\n${AT_THE_LIMIT.replace("Don't", "Do not").replace("That's", "That is")}\n`, en, "blog/owned-media");
    assert.deepEqual(contracted, expanded);
    assert.deepEqual(contracted, ["7"]);
  });

  it("does not add to a Japanese length, which is in characters", () => {
    assert.deepEqual(findingsOf(`# 見出し\n\n${SHORT_JA_FOR_CONTRACTIONS}\n`, ja, "blog/tech"), []);
  });
});

const SHORT_JA_FOR_CONTRACTIONS = Array.from({ length: 8 }, (_, index) => `これは${String(index)}番目の文で、don't と書きます。`).join("");

const SHORT_JA = Array.from({ length: 8 }, (_, index) => `これは${String(index)}番目の文です。`).join("");
const LONG_JA = Array.from(
  { length: 6 },
  (_, index) =>
    `第${String(index + 1)}の手順では、申請書の記載内容と添付書類の写しを担当者が一件ずつ突き合わせ、食い違いがあれば申請者に電話で確認したうえで、確認の結果を台帳に記録して上長の承認を受けます。`,
).join("");

describe("max-paragraph-length (Japanese)", () => {
  it("valid: 短い文を 8 つ並べた段落は、壁にならない", () => {
    assert.deepEqual(findingsOf(`# 見出し\n\n${SHORT_JA}\n`, ja, "blog/tech"), []);
  });

  it("valid: 普通より少し短い文を 6 つ並べた段落（上限 × 普通の文より短い）は指摘しない", () => {
    const moderate = Array.from({ length: 6 }, (_, index) => `第${String(index + 1)}の手順では、申請書と添付書類を担当者が突き合わせて確認します。`).join("");
    assert.deepEqual(findingsOf(`# 見出し\n\n${moderate}\n`, ja, "blog/tech"), []);
  });

  it("invalid: 長い文を 6 つ詰めた段落は、これまでどおり指摘する", () => {
    assert.deepEqual(findingsOf(`# 見出し\n\n${LONG_JA}\n`, ja, "blog/tech"), ["6"]);
  });

  it("法令の上限（12 文）では、同じ段落も長すぎない", () => {
    assert.deepEqual(findingsOf(`# 見出し\n\n${LONG_JA}\n`, ja, "legal/statute"), []);
  });
});

// 自作: 特許の明細書のように、【段落番号】と【見出し】の行を改行一つで本文とつないだ文書。
const STEP = (index: number): string => LONG_JA.slice(0, LONG_JA.indexOf("。") + 1).replace("第1", `第${String(index)}`);
const NUMBERED_PARAGRAPHS = [
  "【０００１】",
  "【技術分野】",
  `${STEP(1)}${STEP(2)}${STEP(3)}`,
  "【０００２】",
  "【背景技術】",
  `${STEP(4)}${STEP(5)}${STEP(6)}`,
].join("\n");

describe("max-paragraph-length: 【】の見出しと、改行の落ちた見出し", () => {
  it("valid: 【】の見出しや段落番号だけの行は、段落の切れ目と読む", () => {
    assert.deepEqual(findingsOf(`# 明細書\n\n${NUMBERED_PARAGRAPHS}\n`, ja, "blog/tech"), []);
  });

  it("invalid: 切れ目の行の間に長い文を詰めれば、その組を指す", () => {
    const dense = `${NUMBERED_PARAGRAPHS}\n${STEP(7)}`;
    assert.deepEqual(findingsOf(`# 明細書\n\n${dense.replace("【０００２】\n【背景技術】\n", "")}\n`, ja, "blog/tech"), ["7"]);
    assert.deepEqual(findingsOf(`# 明細書\n\n${dense.replace("【０００２】\n【背景技術】\n", "")}\n`.replace("【技術分野】\n", ""), ja, "blog/tech"), ["7"]);
  });

  it("valid: 番号付きの見出しに改行なしで本文が続く段落（改行の落ちた文書）は測らない", () => {
    assert.deepEqual(findingsOf(`２【沿革】${LONG_JA}\n`, ja, "business/report"), []);
    assert.deepEqual(findingsOf(`３【事業の内容】\u3000${LONG_JA}\n`, ja, "business/report"), []);
  });

  it("invalid: 番号の無い【】のラベルで始まる段落と、見出しが行に一つだけの段落は測る", () => {
    assert.deepEqual(findingsOf(`【重要】${LONG_JA}\n`, ja, "business/report"), ["6"]);
    assert.deepEqual(findingsOf(`２【沿革】\n${LONG_JA}\n`, ja, "business/report"), ["6"]);
  });
});

describe("labelledBlocks and opensWithFusedHeading", () => {
  const sentence = (start: number, end: number): { span: { start: number; end: number } } => ({ span: { start, end } });
  it("splits at lines holding only a 【】 label, counting from the paragraph's start", () => {
    const text = "一。二。\n【０００２】\n三。";
    const blocks = labelledBlocks(text, 100, [sentence(100, 102), sentence(102, 104), sentence(105, 115)]);
    assert.deepEqual(
      blocks.map((block) => block.length),
      [2, 1],
    );
    assert.deepEqual(labelledBlocks("一。【注】二。", 0, [sentence(0, 2), sentence(2, 7)]).length, 1);
    assert.deepEqual(labelledBlocks("", 0, []), []);
  });

  it("a numbered 【】 heading with its body on the same line", () => {
    assert.equal(opensWithFusedHeading("２【沿革】1893年"), true);
    assert.equal(opensWithFusedHeading("①【株式の総数】種類"), true);
    assert.equal(opensWithFusedHeading("２【沿革】\n1893年"), false);
    assert.equal(opensWithFusedHeading("２【沿革】"), false);
    assert.equal(opensWithFusedHeading("【重要】本日"), false);
    assert.equal(opensWithFusedHeading("本文の中の２【沿革】は"), false);
    assert.equal(opensWithFusedHeading(""), false);
  });
});
