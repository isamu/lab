import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import {
  cellFigure,
  cellRate,
  proseValues,
  ratioDisagreement,
  sentenceRatioMismatch,
  tableRatioMismatches,
  type RatioSentence,
  type RatioWords,
  type TableRow,
} from "../packages/chaff/src/structure/ratio.ts";
import type { LanguageAdapter, LexiconEntry } from "../packages/chaff/src/plugin.ts";

// 率の行と、その分子・分母の行の割り算（ratio-mismatch）。例は自作。

const RULE = "ratio-mismatch";

const found = (text: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", `# 報告\n\n${text}\n`, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["written"])}:${String(finding.values["computed"])}`);

const table = (rows: readonly string[]): string => ["| 項目 | 前期 | 当期 |", "| --- | --- | --- |", ...rows].join("\n");

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

describe("ratioDisagreement", () => {
  const figure = (value: number, step = 1, unit = "|"): { start: number; value: number; step: number; unit: string } => ({ start: 0, value, step, unit });
  const rate = (value: number, decimals = 1): { start: number; value: number; decimals: number } => ({ start: 0, value, decimals });

  it("is silent when the written ratio is within its rounding of the division", () => {
    assert.equal(ratioDisagreement(rate(7.3), figure(96), figure(1320)), undefined);
    assert.equal(ratioDisagreement(rate(7.0), figure(84), figure(1200)), undefined);
    assert.equal(ratioDisagreement(rate(7), figure(84), figure(1200)), undefined);
  });

  it("gives the computed ratio, to the written decimals, when no rounding reaches it", () => {
    assert.equal(ratioDisagreement(rate(8.0), figure(96), figure(1320)), "7.3");
    assert.equal(ratioDisagreement(rate(9, 0), figure(84), figure(1200)), "7");
    assert.equal(ratioDisagreement(rate(12.4, 2), figure(12300), figure(100000)), "12.30");
  });

  it("allows each amount one whole step of its last digit (results tables round down)", () => {
    // 96 / 1,320 = 7.27%; 97 / 1,319 = 7.35%, so 7.35% is reachable, 7.5% is not.
    assert.equal(ratioDisagreement(rate(7.35, 2), figure(96), figure(1320)), undefined);
    assert.equal(ratioDisagreement(rate(7.5), figure(96), figure(1320)), "7.3");
    // Small amounts give a wide range: 5 / 40 can be anything from 9.8% to 15.4%.
    assert.equal(ratioDisagreement(rate(15.0), figure(5), figure(40)), undefined);
  });

  it("does not compare amounts in different units, a negative numerator, or a denominator that may be zero", () => {
    assert.equal(ratioDisagreement(rate(50), figure(96, 1, "|百万円"), figure(1320, 1, "|千円")), undefined);
    assert.equal(ratioDisagreement(rate(50), figure(-5), figure(100)), undefined);
    assert.equal(ratioDisagreement(rate(50), figure(5), figure(1)), undefined);
    assert.equal(ratioDisagreement(rate(50), figure(5), figure(0)), undefined);
  });
});

describe("cell readers", () => {
  const units = ["%", "％"];
  it("reads a percentage and an amount with what is written around its number", () => {
    assert.deepEqual(cellRate("7.3%", 4, units, false), { start: 4, value: 7.3, decimals: 1 });
    assert.deepEqual(cellRate("7.3", 4, units, true), { start: 4, value: 7.3, decimals: 1 });
    assert.deepEqual(cellFigure("$2,400 million", 0, units), { start: 0, value: 2400, step: 1, unit: "$|million" });
    assert.deepEqual(cellFigure("1,320百万円", 0, units), { start: 0, value: 1320, step: 1, unit: "|百万円" });
    assert.deepEqual(cellFigure("12.5", 0, units), { start: 0, value: 12.5, step: 0.1, unit: "|" });
  });

  it("does not read a dash, a sign, a bracket, two numbers, or a bare number as a percentage", () => {
    assert.equal(cellRate("—", 0, units, false), undefined);
    assert.equal(cellRate("7.3", 0, units, false), undefined);
    assert.equal(cellRate("+7.3%", 0, units, false), undefined);
    assert.equal(cellFigure("▲50", 0, units), undefined);
    assert.equal(cellFigure("-50", 0, units), undefined);
    assert.equal(cellFigure("(1,200)", 0, units), undefined);
    assert.equal(cellFigure("1,200 (1,100)", 0, units), undefined);
    assert.equal(cellFigure("7.3%", 0, units), undefined);
    assert.equal(cellFigure("", 0, units), undefined);
  });
});

describe("proseValues", () => {
  const words = { before: ["$", "US$"], after: ["円", "yen"], multipliers: ["million", "万"], percentUnits: ["%", "percent"] };
  const units = (text: string): string[] => proseValues(text, 0, words).figures.map((figure) => `${String(figure.value)}:${figure.unit}`);

  it("reads each amount of money in the unit written around it, and a percentage as a rate", () => {
    assert.deepEqual(units("営業利益は96百万円、売上高は1,320百万円で"), ["96:|百万円", "1320:|百万円"]);
    assert.deepEqual(units("$198 million on sales of US$2,640 million yen"), ["198:$|million", "2640:us$|million yen"]);
    assert.deepEqual(proseValues("営業利益率は7.3%となり", 10, words).rates, [{ start: 16, value: 7.3, decimals: 1 }]);
    assert.deepEqual(proseValues("a margin of 7.5 percent.", 0, words).rates, [{ start: 12, value: 7.5, decimals: 1 }]);
    assert.deepEqual(units("12.5万円"), ["12.5:|万円"]);
  });

  it("keeps a number with no currency apart, does not read a signed one, and ends a unit at a particle", () => {
    assert.deepEqual(units("営業損益は▲50百万円"), []);
    assert.deepEqual(units("profit of -$5 million"), []);
    assert.deepEqual(units("96百万円で"), ["96:|百万円"]);
    assert.deepEqual(units("96 companies in 2026"), []);
    assert.deepEqual(proseValues("96 companies in 2026", 0, words).others, [0, 16]);
    assert.deepEqual(proseValues("7.5 percentage", 0, words).rates, []);
  });
});

const WORDS: RatioWords = {
  labels: [{ pattern: "営業利益率", numerator: "operating-profit", denominator: "sales" }],
  terms: [
    { pattern: "営業利益", term: "operating-profit" },
    { pattern: "売上高", term: "sales" },
  ],
  percentUnits: ["%"],
};

const row = (label: string, ...cells: string[]): TableRow => ({ label, cells: cells.map((text, index) => ({ start: index, text })) });

describe("tableRatioMismatches", () => {
  it("compares each column of the ratio row with the numerator row over the denominator row", () => {
    const rows = [row("売上高", "1,200", "1,320"), row("営業利益", "84", "96"), row("営業利益率", "7.0%", "8.0%")];
    assert.deepEqual(tableRatioMismatches(rows, WORDS), [{ offset: 1, values: { written: "8.0", computed: "7.3", ratio: "営業利益率" } }]);
  });

  it("reads a ratio row whose label carries the percent sign in brackets", () => {
    const rows = [row("売上高", "1,200"), row("営業利益", "84"), row("営業利益率（%）", "9.0")];
    assert.deepEqual(
      tableRatioMismatches(rows, WORDS).map((issue) => issue.values["computed"]),
      ["7.0"],
    );
  });

  it("is silent: a row missing, a row twice, columns not aligned, a cell not a number, units differ", () => {
    assert.deepEqual(tableRatioMismatches([row("営業利益", "84"), row("営業利益率", "9.0%")], WORDS), []);
    assert.deepEqual(tableRatioMismatches([row("売上高", "1,200"), row("売上高", "1,300"), row("営業利益", "84"), row("営業利益率", "9.0%")], WORDS), []);
    assert.deepEqual(tableRatioMismatches([row("売上高", "1,200", "1,320"), row("営業利益", "84"), row("営業利益率", "9.0%", "9.0%")], WORDS), []);
    assert.deepEqual(tableRatioMismatches([row("売上高", "1,200"), row("営業利益", "—"), row("営業利益率", "9.0%")], WORDS), []);
    assert.deepEqual(tableRatioMismatches([row("売上高", "1,200百万円"), row("営業利益", "84,000千円"), row("営業利益率", "9.0%")], WORDS), []);
    assert.deepEqual(tableRatioMismatches([row("売上高", "1,200"), row("営業利益", "84"), row("営業利益率", "7.0%")], WORDS), []);
  });

  it("does not read a row whose label only contains a word of the lexicons", () => {
    assert.deepEqual(tableRatioMismatches([row("売上高", "1,200"), row("営業利益", "84"), row("営業利益率の目標", "9.0%")], WORDS), []);
  });
});

describe("sentenceRatioMismatch", () => {
  const label = WORDS.labels[0];
  // 「営業利益は96百万円、売上高は1,320百万円で、営業利益率は8.0%」の位置。
  const hits =
    label === undefined
      ? []
      : [
          { start: 0, end: 4, term: "operating-profit" },
          { start: 12, end: 15, term: "sales" },
          { start: 30, end: 35, label },
        ];
  const figures = [
    { start: 6, value: 96, step: 1, unit: "|百万円" },
    { start: 17, value: 1320, step: 1, unit: "|百万円" },
  ];
  const sentence = (rate: number, more: Partial<RatioSentence> = {}): RatioSentence => ({
    end: 45,
    hits,
    figures,
    rates: [{ start: 37, value: rate, decimals: 1 }],
    others: [],
    ...more,
  });

  it("compares the only value after each of the three names", () => {
    assert.equal(sentenceRatioMismatch(sentence(8.0))?.values["computed"], "7.3");
    assert.equal(sentenceRatioMismatch(sentence(7.3)), undefined);
  });

  it("is silent: a name twice, a value far from its name, two numbers after a name, a percentage where an amount belongs", () => {
    assert.equal(sentenceRatioMismatch(sentence(8.0, { hits: [...hits, { start: 40, end: 43, term: "sales" }] })), undefined);
    assert.equal(sentenceRatioMismatch(sentence(8.0, { end: 90, rates: [{ start: 80, value: 8.0, decimals: 1 }] })), undefined);
    // 「売上高は前期の1,200百万円から1,320百万円」: which one is the denominator is not known.
    assert.equal(sentenceRatioMismatch(sentence(8.0, { others: [16] })), undefined);
    assert.equal(sentenceRatioMismatch(sentence(8.0, { figures: [{ start: 17, value: 1200, step: 1, unit: "|百万円" }, ...figures] })), undefined);
    assert.equal(sentenceRatioMismatch(sentence(8.0, { others: [42] })), undefined);
    assert.equal(
      sentenceRatioMismatch(
        sentence(8.0, {
          figures: figures.slice(1),
          rates: [
            { start: 6, value: 9, decimals: 0 },
            { start: 37, value: 8.0, decimals: 1 },
          ],
        }),
      ),
      undefined,
    );
    assert.equal(sentenceRatioMismatch(sentence(8.0, { hits: hits.filter((hit) => !("label" in hit)) })), undefined);
  });
});

describe("ratio-mismatch", () => {
  it("ja: a results table", () => {
    assert.deepEqual(found(table(["| 売上高 | 1,200 | 1,320 |", "| 営業利益 | 84 | 96 |", "| 営業利益率 | 7.0% | 8.0% |"]), ja), ["8.0:7.3"]);
    assert.deepEqual(found(table(["| 売上高 | 1,200 | 1,320 |", "| 営業利益 | 84 | 96 |", "| 営業利益率 | 7.0% | 7.3% |"]), ja), []);
    assert.deepEqual(found(table(["| 売上高 | 2,400百万円 | 2,640百万円 |", "| 経常利益 | 168百万円 | 198百万円 |", "| 経常利益率 | 7.0% | 8.5% |"]), ja), [
      "8.5:7.5",
    ]);
    assert.deepEqual(
      found(table(["| 売上高 | 2,400百万円 | 2,640百万円 |", "| 営業利益 | 168百万円 | 198,000千円 |", "| 営業利益率 | 7.0% | 8.5% |"]), ja),
      [],
    );
  });

  it("en: a results table, and a margin no lexicon names", () => {
    const rows = (margin: string): string =>
      [
        "| Item | FY2025 | FY2026 |",
        "| --- | --- | --- |",
        "| Net sales | $2,400 million | $2,640 million |",
        "| Operating profit | $168 million | $198 million |",
        `| ${margin} | 7.0% | 8.5% |`,
      ].join("\n");
    assert.deepEqual(found(rows("Operating margin"), en), ["8.5:7.5"]);
    assert.deepEqual(found(rows("Utilisation rate"), en), []);
  });

  it("ja: one sentence with the three names and their values", () => {
    assert.deepEqual(found("当期の営業利益は96百万円、売上高は1,320百万円で、営業利益率は8.0%となりました。", ja), ["8.0:7.3"]);
    assert.deepEqual(found("当期の営業利益は96百万円、売上高は1,320百万円で、営業利益率は7.3%となりました。", ja), []);
    // 売上高が二度出る文は、どちらの値か決まらない。
    assert.deepEqual(found("売上高は前期の売上高1,200百万円から伸び、営業利益は96百万円、売上高は1,320百万円で、営業利益率は8.0%でした。", ja), []);
  });

  it("en: one sentence with the three names and their values", () => {
    assert.deepEqual(found("Operating profit was $198 million on net sales of $2,640 million, an operating margin of 8.5%.", en), ["8.5:7.5"]);
    assert.deepEqual(found("Operating profit was $198 million on net sales of $2,640 million, an operating margin of 7.5%.", en), []);
    assert.deepEqual(found("Operating profit was $198 million on net sales of $2,640 thousand, an operating margin of 8.5%.", en), []);
    assert.deepEqual(found("Operating profit was $198 million on net sales of $2,640 million, an operating margin of 8.5 percent.", en), ["8.5:7.5"]);
    // A year between a name and its amount leaves the amount unknown.
    assert.deepEqual(found("Operating profit in 2026 was $198 million on net sales in 2026 of $2,640 million, an operating margin of 8.5%.", en), []);
  });

  it("does not read a name inside a longer word, or rows whose labels note different units", () => {
    assert.deepEqual(found("営業利益は96百万円、売上高は1,320百万円で、調整後営業利益率は8.0%でした。", ja), []);
    assert.deepEqual(found("営業利益は前期の84百万円から96百万円に、売上高は1,320百万円で、営業利益率は8.0%でした。", ja), []);
    const noted = [
      "| Item | FY2026 |",
      "| --- | --- |",
      "| Net sales (thousand yen) | 1,320 |",
      "| Operating profit (million yen) | 96 |",
      "| Operating margin | 8.0% |",
    ];
    assert.deepEqual(found(noted.join("\n"), en), []);
    assert.deepEqual(found(noted.map((line) => line.replace("thousand", "million")).join("\n"), en), ["8.0:7.3"]);
  });
});

// The structure tree's quantities do not read every notation below yet (¥1,320 in Japanese, 1,320 yen), so the prose path keeps
// its own reader; routing it through the tree must first pass this.
describe("ratio-mismatch reads every currency notation and percent unit in prose", () => {
  /** The entries of a lexicon; an empty one would leave the cases below with nothing to check. */
  const lexicon = (adapter: LanguageAdapter, id: string): readonly LexiconEntry[] => {
    const entries = buildDocument("t.md", "# r\n", adapter).lexicons[id] ?? [];
    assert.notEqual(entries.length, 0, `${adapter.id}: lexicon ${id}`);
    return entries;
  };
  const LATIN_WORD = /^[A-Za-z]/u;

  /**
   * An amount as the notation writes it: a mark before the number, or a unit after it; a Latin word, or any word in English, after
   * a space. A Japanese word of magnitude goes only with a Japanese unit (96百万円, not 96百万 JPY).
   */
  const amountsOf = (adapter: LanguageAdapter, magnitude: string): ((value: string) => string)[] =>
    lexicon(adapter, "currency-notation").flatMap((notation) => {
      const english = adapter.id === "en";
      const latinAfter = notation.position !== "before" && LATIN_WORD.test(notation.pattern);
      if (!english && latinAfter && magnitude !== "") return [];
      const scaled = (value: string): string => (english && magnitude !== "" ? `${value} ${magnitude}` : `${value}${magnitude}`);
      if (notation.position === "before") return [(value: string) => `${notation.pattern}${scaled(value)}`];
      return [(value: string) => `${scaled(value)}${english || latinAfter ? " " : ""}${notation.pattern}`];
    });

  const sentence = (adapter: LanguageAdapter, top: string, bottom: string, rate: string): string =>
    adapter.id === "ja"
      ? `営業利益は${top}、売上高は${bottom}で、営業利益率は${rate}となりました。`
      : `Operating income was ${top} and net sales were ${bottom}, an operating margin of ${rate}.`;

  const cases: readonly (readonly [LanguageAdapter, readonly string[]])[] = [
    [ja, ["", "百万", "千"]],
    [en, ["", "million"]],
  ];

  const everyAmount = (): { readonly adapter: LanguageAdapter; readonly amount: (value: string) => string }[] =>
    cases.flatMap(([adapter, magnitudes]) => magnitudes.flatMap((magnitude) => amountsOf(adapter, magnitude).map((amount) => ({ adapter, amount }))));

  it("reports a ratio the two amounts cannot give, and not one they can, whatever the notation", () => {
    everyAmount().forEach(({ adapter, amount }) => {
      const [top, bottom] = [amount("96"), amount("1,320")];
      const label = `${adapter.id}: ${top} / ${bottom}`;
      assert.deepEqual(found(sentence(adapter, top, bottom, "8.0%"), adapter), ["8.0:7.3"], label);
      assert.deepEqual(found(sentence(adapter, top, bottom, "7.3%"), adapter), [], label);
    });
  });

  it("reads the ratio in every percent unit", () => {
    cases.forEach(([adapter]) =>
      lexicon(adapter, "percent-unit").forEach((unit) => {
        const rate = LATIN_WORD.test(unit.pattern) ? `8.0 ${unit.pattern}` : `8.0${unit.pattern}`;
        const [top, bottom] = adapter.id === "ja" ? ["96百万円", "1,320百万円"] : ["$96 million", "$1,320 million"];
        assert.deepEqual(found(sentence(adapter, top, bottom, rate), adapter), ["8.0:7.3"], `${adapter.id}: ${rate}`);
      }),
    );
  });
});
