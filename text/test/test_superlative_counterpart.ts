import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { superlativeReported } from "./rule-run.ts";
import { comparisonMarkersOf, counterpartBefore, onlyQuoted, quotedRange } from "../packages/chaff/src/detectors/superlative-comparison.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, LexiconEntry, Sentence, Token } from "../packages/chaff/src/plugin.ts";

// 比べる相手を言う「のほうが」「との」と、引いた言葉の中の最上級。例文はすべて自作。

await ja.prepare?.({ pos: true });
await en.prepare?.({ pos: true });

describe("のほうが・と比べる（文のどこにあっても相手を言う）", () => {
  it("相手があれば指摘しない", () => {
    assert.ok(!superlativeReported(ja, "前者は短いです。後者のほうが圧倒的に長いです。"));
    assert.ok(!superlativeReported(ja, "他社と比べて最も速いです。"));
    assert.ok(!superlativeReported(ja, "他社と比べると最も速いです。"));
  });

  it("相手が無ければ指摘する", () => {
    assert.ok(superlativeReported(ja, "後者は圧倒的に長いです。"));
    assert.ok(superlativeReported(ja, "これが最も速いです。"));
  });

  it("語の一部には当たらない（「方が」だけ、「比べる」だけ）", () => {
    assert.ok(superlativeReported(ja, "この方が最も詳しいです。"));
    assert.ok(superlativeReported(ja, "担当の方が最も詳しいです。"));
    assert.ok(superlativeReported(ja, "背を比べて最も高い人です。"));
  });
});

describe("との（最上級のすぐ前にあるときだけ相手を言う）", () => {
  it("すぐ前にあれば指摘しない", () => {
    assert.ok(!superlativeReported(ja, "ここが SES との最大の分岐点です。"));
    assert.ok(!superlativeReported(ja, "従来製品との最大の違いは重さです。"));
    assert.ok(!superlativeReported(ja, "他社との唯一の差です。"));
  });

  it("離れていれば相手ではないので指摘する", () => {
    assert.ok(superlativeReported(ja, "チームとの会議で最高の成果を出しました。"));
    assert.ok(superlativeReported(ja, "顧客との約束は最も大切です。"));
  });

  it("「との」で終わらない語は相手ではない（ことの・あとの）", () => {
    assert.ok(superlativeReported(ja, "大切なことの最大の理由です。"));
    assert.ok(superlativeReported(ja, "そのあとの最大の山場です。"));
  });
});

describe("引いた言葉の中の最上級", () => {
  it("鉤括弧と引用符の中は指摘しない", () => {
    assert.ok(!superlativeReported(ja, "返答は「これは防ぎたかった唯一のことだ」でした。"));
    assert.ok(!superlativeReported(ja, "題は『最高の一日』です。"));
    assert.ok(!superlativeReported(en, 'The tool replied "this is the best answer" and stopped.'));
    assert.ok(!superlativeReported(en, "The tool replied “this is the best answer” and stopped."));
  });

  it("括弧の外の最上級が限られていれば、中の最上級と合わせて指摘しない", () => {
    assert.ok(!superlativeReported(ja, "「最高」と言われますが、日本で最高の店です。"));
    assert.ok(!superlativeReported(en, 'Critics said "the best" about it, and it is the best pizza in Chicago.'));
  });

  it("括弧の外にもあれば、外の最上級を指摘する", () => {
    assert.ok(superlativeReported(ja, "「最高」と書いたとおり、最高の品質です。"));
    assert.ok(superlativeReported(en, 'They call it "the best", and it is the best tool.'));
  });

  it("括弧の外だけなら指摘する。閉じない括弧は中身を作らない", () => {
    assert.ok(superlativeReported(ja, "これは唯一の欠点だ。"));
    assert.ok(superlativeReported(ja, "返答は「これは唯一のことだ。"));
    assert.ok(superlativeReported(en, "This is the best answer."));
  });
});

const token = (surface: string, start: number): Token => ({ surface, pos: "ADP", span: { start, end: start + surface.length } });

const entry = (pattern: string, words: readonly Token[], position?: "before" | "after"): LexiconEntry => ({ pattern, tokens: words, position });

describe("comparisonMarkersOf / counterpartBefore", () => {
  const marker = entry("との", [token("と", 0), token("の", 1)], "before");
  const tokens = [token("SES", 0), token("と", 3), token("の", 4), token("最大", 5)];

  it("position で分ける。position の無い語は文のどこでも、before の語はすぐ前だけ", () => {
    const markers = comparisonMarkersOf([entry("より", [token("より", 0)]), marker, entry("in", [token("in", 0)], "after")]);
    assert.deepEqual(
      markers.anywhere.map((each) => each.pattern),
      ["より"],
    );
    assert.deepEqual(
      markers.before.map((each) => each.pattern),
      ["との"],
    );
  });

  it("最上級のちょうど手前で終わるときだけ", () => {
    assert.ok(counterpartBefore(tokens, { start: 3, end: 4 }, [marker]));
    assert.ok(!counterpartBefore(tokens, { start: 2, end: 4 }, [marker]));
    assert.ok(!counterpartBefore(tokens, { start: 1, end: 4 }, [marker]));
    assert.ok(!counterpartBefore(tokens, { start: 0, end: 1 }, [marker]));
  });

  it("文頭の相手の語でも当たる", () => {
    assert.ok(counterpartBefore([token("と", 0), token("の", 1), token("最大", 2)], { start: 2, end: 3 }, [marker]));
  });

  it("語の並びの無い語、空の語彙表は当たらない", () => {
    assert.ok(!counterpartBefore(tokens, { start: 3, end: 4 }, [entry("との", [])]));
    assert.ok(!counterpartBefore(tokens, { start: 3, end: 4 }, [{ pattern: "との" }]));
    assert.ok(!counterpartBefore(tokens, { start: 3, end: 4 }, []));
  });
});

describe("quotedRange", () => {
  const sentenceOf = (text: string, at: number, words: readonly Token[]): Sentence => ({
    text,
    span: { start: at, end: at + text.length },
    tokens: words.map((word) => ({ ...word, span: { start: word.span.start + at, end: word.span.end + at } })),
  });

  it("文書の途中の文でも、括弧の中の語を中と読む", () => {
    const sentence = sentenceOf("「最高」だ", 100, [token("「", 0), token("最高", 1), token("」", 3), token("だ", 4)]);
    assert.ok(quotedRange(sentence, { start: 1, end: 2 }));
    assert.ok(!quotedRange(sentence, { start: 3, end: 4 }));
  });

  it("括弧をまたぐ並び、語の無い範囲は中ではない", () => {
    const sentence = sentenceOf("「最高」だ", 0, [token("「", 0), token("最高", 1), token("」", 3), token("だ", 4)]);
    assert.ok(!quotedRange(sentence, { start: 1, end: 4 }));
    assert.ok(!quotedRange(sentence, { start: 5, end: 6 }));
    assert.ok(!quotedRange({ text: sentence.text, span: sentence.span }, { start: 1, end: 2 }));
  });
});

describe("onlyQuoted（品詞の無い文でも引用の中を読む）", () => {
  const plain = (text: string): Sentence => ({ text, span: { start: 0, end: text.length } });
  const best: LexiconEntry = { pattern: "the best" };

  it("引用の中にしか無ければ真", () => {
    assert.ok(onlyQuoted(plain('The tool replied "this is the best answer".'), best));
    assert.ok(onlyQuoted(plain("返答は「唯一のことだ」でした。"), { pattern: "唯一の" }));
  });

  it("外にもあれば偽。閉じない引用符は中身を作らない", () => {
    assert.ok(!onlyQuoted(plain('They call it "the best", and it is the best tool.'), best));
    assert.ok(!onlyQuoted(plain('He said "this is the best tool.'), best));
    assert.ok(!onlyQuoted(plain("It is the best tool."), best));
  });
});

describe("品詞の無い文書でも、引いた言葉の中の最上級は指摘しない", () => {
  /** 文を切るだけで品詞を読まない adapter。 */
  const untagged: LanguageAdapter = { ...en, segment: (text) => ({ sentences: [{ text, span: { start: 0, end: text.length } }] }) };

  it("引用の中だけなら指摘せず、外にあれば指摘する", () => {
    assert.ok(!superlativeReported(untagged, 'The tool replied "this is the best answer" and stopped.'));
    assert.ok(superlativeReported(untagged, "The tool replied that this is the best answer."));
  });
});
