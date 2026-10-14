import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { statedAmountsOf } from "../packages/chaff/src/detectors/stated-amounts.ts";
import { amountsIn, formsOf } from "../packages/chaff/src/detectors/currency-notation.ts";
import { scaleWordsOf } from "../packages/chaff/src/detectors/amount-scale.ts";
import type { ProseDocument } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 倍数・合計の検査が読む金額（stated-amounts）。通貨の書き方で拾った金額を、桁の語ごと一つの金額として読む。

const JA = buildDocument("t.md", "x", ja);
const EN = buildDocument("t.md", "x", en);
const withoutLexicon = (doc: ProseDocument, id: string): ProseDocument => ({ ...doc, lexicons: { ...doc.lexicons, [id]: [] } });
const DOCS: readonly ProseDocument[] = [JA, EN, withoutLexicon(JA, "amount-multiplier"), withoutLexicon(EN, "currency-notation")];

const NUMBERS = ["1", "12", "1,200", "1,234,567", "0", "3.5", "１２", "1.2.3", "12,34", "007", "", "一"];
const SCALES = ["", "万", "億", "千", "億2,000万", " million", "k", "K", " billion", "M", "百万"];
const MARKS_BEFORE = ["", "$", "¥", "￥", "USD ", "US$", "€", "£", "JPY "];
const MARKS_AFTER = ["", "円", "ドル", " yen", " dollars", " USD", "万円"];
const GLUE = ["", " ", "、", "約", "about ", "（", "|", "\n", "1", "-"];
const TEXTS = 3000;
const SEED = 12345;
const MODULUS = 2 ** 31;
const MULTIPLIER = 1103515245;
const INCREMENT = 12345;
const MAX_PIECES = 5;

/** Texts made of amounts in every currency mark and word of scale, and of malformed numbers between them, from a fixed seed. */
const generatedTexts = (count: number): string[] => {
  const state = { seed: SEED };
  const next = (bound: number): number => {
    state.seed = (state.seed * MULTIPLIER + INCREMENT) % MODULUS;
    return state.seed % bound;
  };
  const pick = (choices: readonly string[]): string => choices[next(choices.length)] ?? "";
  const piece = (): string => [GLUE, MARKS_BEFORE, NUMBERS, SCALES, MARKS_AFTER, GLUE].map(pick).join("");
  return Array.from({ length: count }, () => Array.from({ length: 1 + next(MAX_PIECES) }, piece).join(""));
};

/** Where the currency notation's written amounts end in the text. */
const writtenEnds = (text: string, doc: ProseDocument): Set<number> =>
  new Set(
    amountsIn(
      text,
      formsOf(doc),
      scaleWordsOf(doc).map((scale) => scale.word),
    ).map((source) => source.offset + source.written.length),
  );

const pairs = generatedTexts(TEXTS).flatMap((text) => DOCS.map((doc) => ({ text, doc })));

describe("statedAmountsOf", () => {
  it("reads an amount with its words of scale as one amount, in Japanese and English", () => {
    assert.deepEqual(statedAmountsOf("総額1億2,000万円", JA), [{ offset: 2, end: 11, currency: "JPY", value: 120_000_000, scale: 100_000_000 }]);
    assert.deepEqual(statedAmountsOf("賃料8万円、敷金2か月分", JA), [{ offset: 2, end: 5, currency: "JPY", value: 80_000, scale: 10_000 }]);
    assert.deepEqual(statedAmountsOf("$1.5 million in total", EN), [{ offset: 0, end: 12, currency: "USD", value: 1_500_000, scale: 1_000_000 }]);
  });

  it("gives the amounts of one currency notation in the order they are written", () => {
    assert.deepEqual(
      statedAmountsOf("賃料8万円、管理費5,000円", JA).map((amount) => amount.value),
      [80_000, 5_000],
    );
  });

  it("gives no scale to an amount written in plain digits", () => {
    assert.deepEqual(statedAmountsOf("12,000円", JA), [{ offset: 0, end: 7, currency: "JPY", value: 12_000, scale: undefined }]);
    assert.deepEqual(statedAmountsOf("Rent: $1,200 per month", EN), [{ offset: 6, end: 12, currency: "USD", value: 1_200, scale: undefined }]);
  });

  it("reads nothing from empty text, a bare number, or a document without currency notation", () => {
    assert.deepEqual(statedAmountsOf("", JA), []);
    assert.deepEqual(statedAmountsOf("no money here 12", EN), []);
    assert.deepEqual(statedAmountsOf("総額1億2,000万円", withoutLexicon(JA, "currency-notation")), []);
  });

  it("reads no amount written with a word of scale the document does not know", () => {
    assert.deepEqual(statedAmountsOf("賃料8万円", withoutLexicon(JA, "amount-multiplier")), []);
    assert.deepEqual(statedAmountsOf("賃料80,000円", withoutLexicon(JA, "amount-multiplier")), [
      { offset: 2, end: 9, currency: "JPY", value: 80_000, scale: undefined },
    ]);
  });

  it("ends every amount where a written amount ends, starting it inside the text before its end", () => {
    const strays = pairs.flatMap(({ text, doc }) => {
      const ends = writtenEnds(text, doc);
      return statedAmountsOf(text, doc).filter((amount) => amount.offset < 0 || amount.offset >= amount.end || !ends.has(amount.end));
    });
    assert.deepEqual(strays, []);
  });

  it("reads at most one amount per written amount, each a finite non-negative value in a currency the document names", () => {
    const wrong = pairs.flatMap(({ text, doc }) => {
      const currencies = new Set(formsOf(doc).map((form) => form.currency));
      const scaleValues = new Set(scaleWordsOf(doc).map((scale) => scale.value));
      const amounts = statedAmountsOf(text, doc);
      const written = amountsIn(
        text,
        formsOf(doc),
        scaleWordsOf(doc).map((scale) => scale.word),
      );
      const bad = amounts.filter(
        (amount) =>
          !Number.isFinite(amount.value) ||
          amount.value < 0 ||
          !currencies.has(amount.currency) ||
          (amount.scale !== undefined && !scaleValues.has(amount.scale)),
      );
      return amounts.length > written.length ? [{ text, amounts }] : bad.map((amount) => ({ text, amounts: [amount] }));
    });
    assert.deepEqual(wrong, []);
  });

  it("finds amounts in most generated texts, so the properties above are not vacuous", () => {
    const read = pairs.filter(({ text, doc }) => statedAmountsOf(text, doc).length > 0).length;
    assert.ok(read * 2 > pairs.length, `only ${String(read)} of ${String(pairs.length)} texts gave an amount`);
  });

  it("gives the same amounts on every call", () => {
    pairs.slice(0, TEXTS).forEach(({ text, doc }) => assert.deepEqual(statedAmountsOf(text, doc), statedAmountsOf(text, doc)));
  });
});
