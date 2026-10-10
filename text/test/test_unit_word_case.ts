import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { isUnitWord as isEnUnitWord, startsWithUnit as startsWithEnUnit } from "../packages/lang-en/src/unit-case.ts";
import { isUnitWord as isJaUnitWord, startsWithUnit as startsWithJaUnit } from "../packages/lang-ja/src/unit-case.ts";
import { loadLexicons as loadEn } from "../packages/lang-en/src/lexicons.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import type { LanguageAdapter, StructureNode } from "../packages/chaff/src/plugin.ts";

type Read = [string, number, string];

const quantitiesOf = (adapter: LanguageAdapter, language: string, source: string): Read[] => {
  const walk = (node: StructureNode): StructureNode[] => [node, ...node.children.flatMap(walk)];
  if (adapter.structure === undefined) throw new Error(`${language} has no structure`);
  return walk(buildStructure({ path: "a.md", source, language, markdown: true }, adapter.structure))
    .filter((node) => node.kind === "quantity")
    .map((node) => [source.slice(node.span.start, node.span.end), Number(node.attrs["value"]), String(node.attrs["unit"])]);
};

const EN = loadEn();
const patternsOf = (id: string): string[] => (EN[id] ?? []).map((entry) => entry.pattern);

describe("isUnitWord: a word is three or more lowercase letters, anything else is a symbol", () => {
  [isEnUnitWord, isJaUnitWord].forEach((isUnitWord, index) => {
    it(`reads words and symbols the same way in both adapters (${index === 0 ? "en" : "ja"})`, () => {
      ["percent", "per cent", "million", "billion", "thousand", "yen", "dollars", "euros"].forEach((unit) => assert.equal(isUnitWord(unit), true, unit));
      ["%", "$", "USD", "JPY", "kDa", "mL", "mM", "kg", "mg", "ms", "m", "g", "s", "円", "ドル", "", "Percent", "per  cent", "per-cent"].forEach((unit) =>
        assert.equal(isUnitWord(unit), false, unit),
      );
    });
  });

  it("finds every percent-unit, amount-multiplier and after-the-number currency word of en; codes and signs stay symbols", () => {
    const words = [...patternsOf("percent-unit"), ...patternsOf("amount-multiplier"), ...patternsOf("currency-notation")].filter(isEnUnitWord);
    assert.deepEqual(new Set(words), new Set(["percent", "per cent", "thousand", "million", "billion", "trillion", "dollars", "yen", "euros"]));
  });

  it("keeps the case of an SI symbol that carries meaning (mL is millilitre, ML megalitre; mM millimolar, MM nothing)", () => {
    patternsOf("measure-unit")
      .filter((unit) => /\p{Lu}/u.test(unit) || unit.length < 3)
      .forEach((unit) => assert.equal(isEnUnitWord(unit), false, unit));
  });
});

describe("startsWithUnit", () => {
  [startsWithEnUnit, startsWithJaUnit].forEach((startsWithUnit) => {
    it("reads a word in any case and a symbol only as written", () => {
      assert.equal(startsWithUnit("8.5 Percent", 4, "percent"), true);
      assert.equal(startsWithUnit("8.5 PER CENT", 4, "per cent"), true);
      assert.equal(startsWithUnit("8.5 per  cent", 4, "per cent"), false);
      assert.equal(startsWithUnit("5 Usd", 2, "USD"), false);
      assert.equal(startsWithUnit("5 ML", 2, "mL"), false);
      assert.equal(startsWithUnit("5 mL", 2, "mL"), true);
      assert.equal(startsWithUnit("5 per", 2, "percent"), false);
      assert.equal(startsWithUnit("", 0, "yen"), false);
    });
  });
});

describe("the tree reads a lexicon unit word in any case (en)", () => {
  it("reads Percent, PERCENT, Per Cent, Million Yen, Million Dollars and Euros as the lexicon's unit", () => {
    assert.deepEqual(
      quantitiesOf(en, "en", "Inflation was 8.5 Percent, then 8.5 PERCENT and 8.5 Per Cent; sales 198 Million Yen, 1,320 Million Dollars and 20 Euros."),
      [
        ["8.5", 8.5, "percent"],
        ["8.5", 8.5, "percent"],
        ["8.5", 8.5, "per cent"],
        ["198", 198, "yen"],
        ["1,320", 1320, "dollars"],
        ["20", 20, "euros"],
      ],
    );
  });

  it("reads a capitalised unit word in a Title Case heading", () => {
    assert.deepEqual(quantitiesOf(en, "en", "## Revenue Grew 8.5 Percent to 198 Million Yen\n\nText.\n"), [
      ["8.5", 8.5, "percent"],
      ["198", 198, "yen"],
    ]);
  });

  it("does not read a capitalised word with no number before it, a code in the wrong case, or an SI symbol", () => {
    assert.deepEqual(quantitiesOf(en, "en", "One in a Million.\n\n| Percent | Yen |\n|---|---|\n| high | low |\n"), []);
    assert.deepEqual(quantitiesOf(en, "en", "Paid 5 Usd and 5 Jpy; 5 Kg and 5 ML of water."), []);
  });

  it("keeps a year before a capitalised currency word a year, and a percentile a percentile", () => {
    assert.deepEqual(quantitiesOf(en, "en", "Costs in 2020 Dollars; the 25 Percentile."), []);
  });
});

describe("the tree reads a Latin multiplier word in any case (ja)", () => {
  before(async () => prepare());

  it("reads Million and MILLION between the number and the currency", () => {
    assert.deepEqual(quantitiesOf(ja, "ja", "売上は 198 Million 円、受注は 1,320 MILLION USD。"), [
      ["198 Million 円", 198e6, "円"],
      ["1,320 MILLION USD", 1320e6, "USD"],
    ]);
  });

  it("does not read a currency code in the wrong case, or Million with no number before it", () => {
    assert.deepEqual(quantitiesOf(ja, "ja", "受注は 1,320 Usd。One in a Million の欄。"), []);
  });
});
