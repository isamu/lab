import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { split, SentenceSplitterSyntax } from "sentence-splitter";
import { chunksOf as chunksOfJa, sentenceSpans as sentenceSpansJa } from "../packages/lang-ja/src/sentence-split.ts";
import { chunksOf as chunksOfEn, sentenceSpans as sentenceSpansEn } from "../packages/lang-en/src/sentence-split.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { unmarkNumberStops } from "../packages/lang-en/src/number-stop.ts";
import { splitAtQuotedStops } from "../packages/lang-en/src/quoted-stop.ts";
import { reattachClosingQuotes } from "../packages/lang-en/src/closing-quote.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import type { Span } from "../packages/chaff/src/plugin.ts";

// 切れ目ごとに渡しても、一度に渡したときと同じ文になること。比べる相手は分割器そのもの。
const wholeSpans = (text: string): Span[] =>
  split(text)
    .filter((node) => node.type === SentenceSplitterSyntax.Sentence)
    .map((node) => ({ start: node.range[0], end: node.range[1] }));

// 分割器の判定が分かれる材料を集める。括弧・引用符・略語・「J.」の形・句点の種類・空白の種類・サロゲートペア。
const FRAGMENTS = [
  "これは",
  "文です",
  "注",
  "𠮷野家",
  "カタカナ",
  "한국어",
  "。",
  "．",
  "？",
  "！",
  "。。",
  "。!",
  ".",
  "?",
  "!",
  "（",
  "）",
  "「",
  "」",
  "『",
  "』",
  "【",
  "】",
  "(",
  ")",
  '"',
  "“",
  "”",
  "‘",
  "’",
  "'",
  "[",
  "]",
  "{",
  "}",
  "Dr.",
  "Mr.",
  "etc.",
  "e.g.",
  "U.S.A.",
  "J.",
  "A.",
  "Smith",
  "smith",
  "the",
  "end.",
  "Act.",
  "section",
  "Yahoo!",
  "1.",
  "2026.",
  "We",
  "No.",
  "vs.",
  " ",
  "  ",
  "\n",
  "\r\n",
  "\t",
  "　",
];

// 括弧の閉じた文。これが続くと切れ目ができる。断片だけでは括弧が開いたままになりやすく、切れ目がほとんど生まれない。
const SENTENCES = [
  "これは（注）文です。",
  "第一条　甲は「乙」に従う。",
  "前項の規定（第二項を除く。）を適用する。",
  "The Act (as amended) applies.",
  "It ends here.",
  "Then see [note] below.",
  'He said "yes" today.',
  "She asked “Is it done?” Nobody knew.",
  "“Stop!” he said.",
  "It was the ’90s.",
];

const MAX_FRAGMENTS = 60;
const SENTENCE_SHARE = 0.4;
const CASES = 4000;
const SEED = 141;

/** mulberry32。同じ seed なら同じ入力列になる。 */
const randomFrom = (seed: number): (() => number) => {
  const state = { value: seed };
  return () => {
    state.value = (state.value + 0x6d2b79f5) | 0;
    const mixed = Math.imul(state.value ^ (state.value >>> 15), 1 | state.value);
    const spread = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((spread ^ (spread >>> 14)) >>> 0) / 4294967296;
  };
};

const generated = (seed: number, count: number): string[] => {
  const random = randomFrom(seed);
  const from = (list: readonly string[]): string => list[Math.floor(random() * list.length)] ?? "";
  const pick = (): string => (random() < SENTENCE_SHARE ? from(SENTENCES) : from(FRAGMENTS));
  return Array.from({ length: count }, () => Array.from({ length: 1 + Math.floor(random() * MAX_FRAGMENTS) }, pick).join(""));
};

describe("文の分割は切れ目ごとに渡しても変わらない", () => {
  it(`生成した入力で、分割器に一度に渡したときと同じ span になる（seed ${String(SEED)}）`, () => {
    generated(SEED, CASES).forEach((text) => {
      const expected = wholeSpans(text);
      assert.deepEqual(sentenceSpansJa(text), expected, JSON.stringify(text));
      assert.deepEqual(sentenceSpansEn(text), expected, JSON.stringify(text));
    });
  });

  // 英語のアダプタは、行の途中の番号を替えてから分割器に渡す。比べる相手も替えた後の文字列を丸ごと渡した分割器。
  it(`英語のアダプタの文は、番号を替えた文字列を分割器に一度に渡し、閉じ引用符の後で切って、文頭の閉じ引用符を戻したときと同じ（seed ${String(SEED)}）`, () => {
    generated(SEED, CASES).forEach((text) => {
      const unmarked = unmarkNumberStops(text);
      assert.equal(unmarked.length, text.length, JSON.stringify(text));
      const spans = en.segment(text).sentences.map((sentence) => sentence.span);
      // 閉じ引用符の内側で閉じた文を切るのと、文頭の閉じ引用符を戻すのは、分割器の後の処理。分割器の文に同じ処理をしたものと比べる。
      assert.deepEqual(
        spans,
        reattachClosingQuotes(
          text,
          wholeSpans(unmarked).flatMap((span) => splitAtQuotedStops(text, span)),
        ),
        JSON.stringify(text),
      );
    });
  });

  it("括弧を含む文が続く段落、複数行の段落、箇条書き、コードブロックでも同じ", () => {
    const texts = [
      "これは（注）文です。".repeat(50),
      "第一条　この法律は（略）定める。\n第二条　前条の規定は「甲」に適用する。\n一　甲（乙を除く。）\n二　丙",
      "The Act (as amended) applies. See section 2 (a).\nThe court may order it. Dr. Smith agreed.",
      "- 一つ目の項目（注）です。\n- 二つ目です。\n  - 入れ子（注）です。",
      "```\nconst a = (1);\n```\n\nこれは文です。",
    ];
    texts.forEach((text) => assert.deepEqual(sentenceSpansJa(text), wholeSpans(text), JSON.stringify(text)));
  });

  it("文書を組み立てた結果も同じ（段落の中の位置のずらし込みまで）", () => {
    const source = ["# 見出し", "", "これは（注）文です。".repeat(20), "", "- 項目（注）です。次です。", "", "```", "code (x).", "```"].join("\n");
    const spans = buildDocument("t.md", source, ja).sentences.map((sentence) => sentence.span);
    const paragraphStart = source.indexOf("これは");
    const expected = wholeSpans("これは（注）文です。".repeat(20)).map((span) => ({ start: span.start + paragraphStart, end: span.end + paragraphStart }));
    assert.deepEqual(spans.slice(0, expected.length), expected);
    const english = "The Act (as amended) applies. The court (or a judge) may order it.\nIt ends in 2026. Then it stops.";
    assert.deepEqual(
      en.segment(english).sentences.map((sentence) => sentence.span),
      wholeSpans(unmarkNumberStops(english)),
    );
  });
});

const cutsOf = (chunks: readonly Span[]): number[] => chunks.slice(1).map((chunk) => chunk.start);

describe("切れ目の置き場所", () => {
  const both = (text: string, expected: readonly number[]): void => {
    assert.deepEqual(cutsOf(chunksOfJa(text)), expected, JSON.stringify(text));
    assert.deepEqual(cutsOf(chunksOfEn(text)), expected, JSON.stringify(text));
    assert.deepEqual(sentenceSpansJa(text), wholeSpans(text), JSON.stringify(text));
  };

  it("括弧を含む文が続けば、文ごとに切る", () => {
    both("これは（注）文です。".repeat(3), [10, 20]);
    both("これは文です。\nあれも文です。", [8]);
    both("It ends here. Then more.", [14]);
    // 開いていない閉じ括弧は、分割器にとって何でもない。
    both("）これは文です。あれも文です。", [8]);
  });

  it("括弧が開いたまま・略語・「J.」の形・句点の後の英字では切らない", () => {
    both("これは（注。文です。", []);
    both("See etc. and more.", []);
    both("これは文です。 J. Smith", []);
    both("これは文です。Dr. Smith", []);
    both("これは（注）。文です。", []);
    // 空白の後の「B.」は、空白を越えて「Aです。これは」まで読み返す。
    both("Aです。これは B. Cat", []);
  });
});
