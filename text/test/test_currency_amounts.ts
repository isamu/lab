import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { currencyAmounts, type AmountVocabulary } from "../packages/lang-ja/src/currency-amounts.ts";
import { currencyAfter, currencyBefore, type CurrencyMarks } from "../packages/lang-en/src/currency-amounts.ts";
import { loadLexicons as loadJa } from "../packages/lang-ja/src/lexicons.ts";
import { loadLexicons as loadEn } from "../packages/lang-en/src/lexicons.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { quantities } from "../packages/lang-ja/src/quantities.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import type { LanguageAdapter, StructureNode } from "../packages/chaff/src/plugin.ts";

const JA = loadJa();
const EN = loadEn();
const marks = (lexicons: typeof JA, position: "before" | "after"): string[] =>
  (lexicons["currency-notation"] ?? []).filter((entry) => entry.position === position).map((entry) => entry.pattern);
const percentUnits = (lexicons: typeof JA): string[] => (lexicons["percent-unit"] ?? []).map((entry) => entry.pattern);

const JA_VOCABULARY: AmountVocabulary = {
  before: marks(JA, "before"),
  after: [...marks(JA, "after"), ...percentUnits(JA)],
  multipliers: (JA["amount-multiplier"] ?? []).flatMap((entry) => (entry.weight === undefined ? [] : [{ pattern: entry.pattern, weight: entry.weight }])),
};

const EN_MARKS: CurrencyMarks = {
  before: marks(EN, "before"),
  after: marks(EN, "after"),
  multipliers: (EN["amount-multiplier"] ?? []).map((entry) => entry.pattern),
};

type Read = [string, number, string];

const jaRead = (text: string, vocabulary: AmountVocabulary = JA_VOCABULARY): Read[] =>
  currencyAmounts(text, vocabulary).map((amount) => [text.slice(amount.start, amount.end), amount.value, amount.unit]);

describe("currencyAmounts (ja): every currency-notation and percent-unit entry", () => {
  it("reads each mark written before the number, with and without one space; US$ is read with the $ that touches the number", () => {
    JA_VOCABULARY.before.forEach((mark) => {
      const unit = mark === "US$" ? "$" : mark;
      assert.deepEqual(jaRead(`売上は${mark}1,320、`), [["1,320", 1320, unit]], mark);
      assert.deepEqual(jaRead(`売上は${mark} 1,320、`), [["1,320", 1320, unit]], `${mark} with a space`);
    });
  });

  it("reads each mark written after the number, with and without one space", () => {
    JA_VOCABULARY.after.forEach((mark) => {
      assert.deepEqual(jaRead(`売上は1,320${mark}、`), [[`1,320${mark}`, 1320, mark]], mark);
      assert.deepEqual(jaRead(`売上は1,320 ${mark}、`), [[`1,320 ${mark}`, 1320, mark]], `${mark} with a space`);
    });
  });

  it("folds every amount-multiplier entry into the value, with a place before it (百万)", () => {
    (JA["amount-multiplier"] ?? []).forEach(({ pattern, weight }) => {
      const gap = /^[a-z]/u.test(pattern) ? " " : "";
      assert.deepEqual(jaRead(`¥96${gap}${pattern}`), [[`96${gap}${pattern}`, 96 * (weight ?? 0), "¥"]], pattern);
    });
    assert.deepEqual(jaRead("1,320兆円"), [["1,320兆円", 1320e12, "円"]]);
    assert.deepEqual(jaRead("1,320百万ユーロ"), [["1,320百万ユーロ", 1320e6, "ユーロ"]]);
  });

  it("takes the mark that touches the number before it (US$ → $) and the longest after it (米ドル, not ドル)", () => {
    assert.deepEqual(jaRead("US$1,320"), [["1,320", 1320, "$"]]);
    assert.deepEqual(jaRead("1,320米ドル"), [["1,320米ドル", 1320, "米ドル"]]);
  });

  it("does not read a year as money when a space stands between it and a mark after it", () => {
    assert.deepEqual(jaRead("2020 USD ベースで"), []);
    assert.deepEqual(jaRead("2026 %"), []);
    assert.deepEqual(jaRead("2,020 USD"), [["2,020 USD", 2020, "USD"]]);
    assert.deepEqual(jaRead("2000ユーロ"), [["2000ユーロ", 2000, "ユーロ"]]);
    assert.deepEqual(jaRead("$2026"), [["2026", 2026, "$"]]);
  });

  it("does not read a Latin mark inside a longer word, or a number inside a word", () => {
    assert.deepEqual(jaRead("XUSD 5"), []);
    assert.deepEqual(jaRead("5 USDT"), []);
    assert.deepEqual(jaRead("v1.2ユーロ"), []);
  });

  it("reads nothing without a mark, from empty input, or with an empty vocabulary", () => {
    assert.deepEqual(jaRead("売上は1,320で、"), []);
    assert.deepEqual(jaRead(""), []);
    assert.deepEqual(jaRead("¥1,320", { before: [], after: [], multipliers: [] }), []);
  });

  it("does not read a malformed number", () => {
    assert.deepEqual(jaRead("¥1.2.3"), []);
    assert.deepEqual(jaRead("¥1,320.、"), [["1,320", 1320, "¥"]]);
  });
});

describe("currencyBefore / currencyAfter (en): every currency-notation entry", () => {
  const after = (text: string, digits: string): string | undefined => currencyAfter(text, text.indexOf(digits) + digits.length, digits, EN_MARKS);

  it("reads each mark before the number, with and without one space; US$ keeps the unit $", () => {
    EN_MARKS.before.forEach((mark) => {
      const expected = mark === "US$" ? "$" : mark;
      assert.equal(currencyBefore(`sales of ${mark}1,320`, `sales of ${mark}`.length, EN_MARKS), expected, mark);
      assert.equal(currencyBefore(`sales of ${mark} 1,320`, `sales of ${mark} `.length, EN_MARKS), expected, `${mark} with a space`);
    });
  });

  it("reads each mark after the number, alone or after a word of magnitude", () => {
    EN_MARKS.after.forEach((mark) => {
      assert.equal(after(`sales of 1,320 ${mark}.`, "1,320"), mark, mark);
      EN_MARKS.multipliers.forEach((word) => assert.equal(after(`sales of 1,320 ${word} ${mark}.`, "1,320"), mark, `${word} ${mark}`));
    });
  });

  it("does not read a year as an amount: in 2020 dollars", () => {
    assert.equal(after("in 2020 dollars", "2020"), undefined);
    assert.equal(after("in 2,020 dollars", "2,020"), "dollars");
    assert.equal(after("2020 million dollars", "2020"), "dollars");
  });

  it("does not read a mark inside a longer word, or a word of magnitude with no mark", () => {
    assert.equal(after("5 USDT", "5"), undefined);
    assert.equal(after("5 yenta", "5"), undefined);
    assert.equal(after("1,320 million users", "1,320"), undefined);
    assert.equal(currencyBefore("XUSD 5", 5, EN_MARKS), undefined);
    assert.equal(currencyBefore("5", 0, EN_MARKS), undefined);
  });
});

const quantitiesOf = (adapter: LanguageAdapter, language: string, source: string): Read[] => {
  const walk = (node: StructureNode): StructureNode[] => [node, ...node.children.flatMap(walk)];
  if (adapter.structure === undefined) throw new Error(`${language} has no structure`);
  return walk(buildStructure({ path: "a.md", source, language, markdown: true }, adapter.structure))
    .filter((node) => node.kind === "quantity")
    .map((node) => [source.slice(node.span.start, node.span.end), Number(node.attrs["value"]), String(node.attrs["unit"])]);
};

describe("the tree reads the currency notations (ja)", () => {
  before(async () => prepare());

  it("adds what the counters do not read, and keeps what they do", () => {
    assert.deepEqual(quantitiesOf(ja, "ja", "営業利益は¥96百万、売上高は1,320米ドル、率は8.0 %、受注は1,320千円。"), [
      ["96百万", 96e6, "¥"],
      ["1,320米ドル", 1320, "米ドル"],
      ["8.0 %", 8, "%"],
      ["1,320千円", 1320e3, "円"],
    ]);
  });

  it("does not read the year 2026 as money, and leaves a date a date", () => {
    assert.deepEqual(
      quantities("2026年に¥1,320を払った。").map((item) => [item.attrs["value"], item.attrs["unit"]]),
      [[1320, "¥"]],
    );
  });

  it("does not read ¥ inside a code span or a code block", () => {
    assert.deepEqual(quantitiesOf(ja, "ja", "コードでは `¥1,320` と書く。\n\n```\n$1,320\n```\n"), []);
  });
});

describe("the tree reads the currency notations (en)", () => {
  it("yen, million yen, dollars, euros, a code after the number, ¥ before it, and per cent", () => {
    assert.deepEqual(
      quantitiesOf(en, "en", "Sales were ¥1,320 million, 1,320 million yen, 96 dollars, 96 euros, 96 USD and 96 EUR, a margin of 8.0 per cent."),
      [
        ["1,320", 1320, "¥"],
        ["1,320", 1320, "yen"],
        ["96", 96, "dollars"],
        ["96", 96, "euros"],
        ["96", 96, "USD"],
        ["96", 96, "EUR"],
        ["8.0", 8, "per cent"],
      ],
    );
  });

  it("reads a currency code glued to the number, and no other number glued to a letter", () => {
    assert.deepEqual(quantitiesOf(en, "en", "Sales were USD96 and JPY1,320; paper A4 and v2 days."), [
      ["96", 96, "USD"],
      ["1,320", 1320, "JPY"],
    ]);
  });

  it("does not read a percentile as a percentage, or a year as money", () => {
    assert.deepEqual(quantitiesOf(en, "en", "The 25 percentile and the 90th percentile; costs in 2020 dollars."), []);
  });

  it("does not read ¥ inside a code span", () => {
    assert.deepEqual(quantitiesOf(en, "en", "Write `¥1,320 million` or `8.0 per cent` here."), []);
  });
});
