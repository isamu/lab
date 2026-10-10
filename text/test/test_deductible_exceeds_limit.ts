import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { basesComparable, deductibleExceeds, sentenceDeductibleOverLimit, type DeductibleWords } from "../packages/chaff/src/structure/deductible-limit.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";
import { proseQuantitiesOf, type ProseQuantity } from "../packages/chaff/src/structure/ratio.ts";
import type { LanguageAdapter, LexiconEntry } from "../packages/chaff/src/plugin.ts";
import { deductibleExceedsLimit } from "../packages/chaff/src/detectors/deductible-exceeds-limit.ts";

// 一つの文の免責金額と支払限度額（deductible-exceeds-limit）。例は自作。

const RULE = "deductible-exceeds-limit";
const CJK = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/u;

const findings = (text: string, adapter: LanguageAdapter) =>
  runRules(buildDocument("t.md", `# 概要\n\n${text}\n`, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report").findings.filter(
    (finding) => finding.rule === RULE,
  );

const found = (text: string, adapter: LanguageAdapter): string[] =>
  findings(text, adapter).map((finding) => `${String(finding.values["deductible"])}>${String(finding.values["limit"])}`);

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

describe("basesComparable", () => {
  const claim = { basis: "claim", rank: 2 };
  const item = { basis: "item", rank: 1 };
  const day = { basis: "day" };
  const year = { basis: "year" };

  it("compares the same basis, and anything with a limit that has no basis", () => {
    assert.equal(basesComparable(claim, claim), true);
    assert.equal(basesComparable(day, day), true);
    assert.equal(basesComparable(day, undefined), true);
    assert.equal(basesComparable(undefined, undefined), true);
  });

  it("compares a deductible on a basis that holds the limit's: per claim against per item", () => {
    assert.equal(basesComparable(claim, item), true);
    assert.equal(basesComparable(item, claim), false);
  });

  it("reads a deductible with no basis as one claim: against a nesting basis only", () => {
    assert.equal(basesComparable(undefined, item), true);
    assert.equal(basesComparable(undefined, claim), true);
    assert.equal(basesComparable(undefined, day), false);
  });

  it("does not compare bases that do not nest", () => {
    assert.equal(basesComparable(day, claim), false);
    assert.equal(basesComparable(claim, day), false);
    assert.equal(basesComparable(year, claim), false);
    assert.equal(basesComparable(day, year), false);
  });
});

describe("deductibleExceeds", () => {
  const stated = (value: number, currency = "|円", basis?: { basis: string; rank?: number }) => ({ value, currency, basis });

  it("reports a larger deductible in the same currency", () => {
    assert.equal(deductibleExceeds(stated(5000), stated(3000)), true);
  });

  it("is silent for an equal or smaller deductible, another currency, or bases that do not nest", () => {
    assert.equal(deductibleExceeds(stated(3000), stated(3000)), false);
    assert.equal(deductibleExceeds(stated(1000), stated(3000)), false);
    assert.equal(deductibleExceeds(stated(5000, "$|"), stated(3000)), false);
    assert.equal(deductibleExceeds(stated(5000, "|円", { basis: "day" }), stated(3000, "|円", { basis: "claim", rank: 2 })), false);
  });
});

describe("sentenceDeductibleOverLimit", () => {
  const words: DeductibleWords = {
    deductibles: ["免責金額", "excess"],
    limits: ["支払限度額", "限度額", "the most we pay", "up to"],
    notDeductibles: ["in excess of", "自己負担限度額"],
    notLimits: ["maximum excess"],
    bases: [
      { pattern: "1回", basis: "claim", rank: 2 },
      { pattern: "1品", basis: "item", rank: 1 },
      { pattern: "a visit", basis: "claim", rank: 2 },
      { pattern: "a day", basis: "day" },
    ],
    approximate: { before: ["約", "about", "up to"], after: ["程度"] },
    rangeMarks: ["〜", "-"],
    multipliers: [{ word: "万", value: 10000 }],
    amounts: { before: ["$", "US$", "¥"], after: ["円"], multipliers: ["万"], percentUnits: ["%"] },
    currencies: [
      { pattern: "$", currency: "USD" },
      { pattern: "US$", currency: "USD" },
      { pattern: "¥", currency: "JPY" },
      { pattern: "円", currency: "JPY" },
    ],
  };
  /** The tree's quantities of the text, as if it started at offset 100 in a document. */
  const quantitiesOf = (text: string): ProseQuantity[] =>
    proseQuantitiesOf(buildDocument("t.md", text, CJK.test(text) ? ja : en).structure).map((quantity) => ({
      ...quantity,
      start: quantity.start + 100,
      end: quantity.end + 100,
    }));
  const read = (text: string) => sentenceDeductibleOverLimit(text, 100, quantitiesOf(text), words)?.values;

  it("reads both amounts and their bases in one sentence, and gives where the deductible is written", () => {
    const text = "免責金額は1回5,000円、1回あたりの支払限度額は3,000円です。";
    assert.deepEqual(read(text), { deductibleWord: "免責金額", deductible: "5,000円", limitWord: "支払限度額", limit: "3,000円" });
    assert.equal(sentenceDeductibleOverLimit(text, 100, quantitiesOf(text), words)?.offset, 100 + text.indexOf("5,000"));
    assert.equal(read("The excess is $80 a visit, and the most we pay for a visit is $50.")?.["deductible"], "$80");
  });

  it("puts a word of magnitude on the same scale (30万円 against 100,000円)", () => {
    assert.equal(read("免責金額は30万円、限度額は100,000円です。")?.["limit"], "100,000円");
    assert.equal(read("免責金額は5万円、限度額は100,000円です。"), undefined);
  });

  it("is silent for a range or a rough amount on either side", () => {
    assert.equal(read("免責金額は約5,000円、支払限度額は3,000円です。"), undefined);
    assert.equal(read("免責金額は5,000円程度、支払限度額は3,000円です。"), undefined);
    assert.equal(read("免責金額は1,000〜5,000円、支払限度額は3,000円です。"), undefined);
    assert.equal(read("The excess is about $80, and the most we pay is $50."), undefined);
  });

  it("takes a limit word that is also a rough mark as the limit (up to $50)", () => {
    assert.equal(read("The excess is $80 a visit, and we pay up to $50 a visit.")?.["limit"], "$50");
  });

  it("is silent when an amount is missing, two amounts follow a word, or a word comes twice", () => {
    assert.equal(read("免責金額は1回5,000円で、支払限度額は別表のとおりです。"), undefined);
    assert.equal(read("免責金額は1回5,000円または8,000円、支払限度額は3,000円です。"), undefined);
    assert.equal(read("免責金額は5,000円、入院の免責金額は8,000円、支払限度額は3,000円です。"), undefined);
  });

  it("does not read a word inside a phrase that does not name it, or inside a longer word", () => {
    assert.equal(read("Costs in excess of $500 are paid, and the most we pay is $300."), undefined);
    assert.equal(read("免責金額は100,000円、自己負担限度額は80,100円です。"), undefined);
  });

  it("reads one currency written two ways as the same (US$ and $, ¥ and 円)", () => {
    assert.equal(read("The excess is US$80 a visit, and the most we pay for a visit is $50.")?.["deductible"], "US$80");
    assert.equal(read("免責金額は¥5,000、支払限度額は3,000円です。")?.["limit"], "3,000円");
  });

  it("gives a basis between the first amount and the second word to the second word, unless it follows the amount", () => {
    assert.equal(read("免責金額は1回300,000円で1品あたりの支払限度額は100,000円です。")?.["deductible"], "300,000円");
    assert.equal(read("The excess is $80 a visit and the most we pay for a visit is $50.")?.["limit"], "$50");
    assert.equal(read("免責金額は1品5,000円で1回あたりの支払限度額は3,000円です。"), undefined);
  });

  it("does not take a limit word that names the deductible as the limit (maximum excess)", () => {
    assert.equal(read("The maximum excess is $80 a visit, and the most we pay for a visit is $50.")?.["deductible"], "$80");
  });

  it("is silent when the bases do not nest or two bases are written by one amount", () => {
    assert.equal(read("The excess is $80 a day, and the most we pay for a visit is $50."), undefined);
    assert.equal(read("免責金額は1品5,000円、1回あたりの支払限度額は3,000円です。"), undefined);
    assert.equal(read("The excess is $80 a visit a day, and the most we pay is $50."), undefined);
  });

  it("is silent for a smaller or equal deductible, and for another currency", () => {
    assert.equal(read("免責金額は1回1,000円、1回あたりの支払限度額は3,000円です。"), undefined);
    assert.equal(read("免責金額は1回3,000円、1回あたりの支払限度額は3,000円です。"), undefined);
    assert.equal(read("The excess is $80 a visit, and the most we pay for a visit is 50円."), undefined);
  });
});

describe("deductible-exceeds-limit (the rule)", () => {
  it("ja: reports a deductible over the limit on the same basis, and one per claim over a per-item limit", () => {
    assert.deepEqual(found("通院給付金の免責金額は1回5,000円、1回あたりの支払限度額は3,000円です。", ja), ["5,000円>3,000円"]);
    assert.deepEqual(found("携行品損害の免責金額は1事故300,000円、1品あたりの支払限度額は100,000円です。", ja), ["300,000円>100,000円"]);
  });

  it("ja: is silent for the corrected sentences and when the two are in different sentences", () => {
    assert.deepEqual(found("通院給付金の免責金額は1回1,000円、1回あたりの支払限度額は3,000円です。", ja), []);
    assert.deepEqual(found("携行品損害の免責金額は1事故3,000円、1品あたりの支払限度額は100,000円です。", ja), []);
    assert.deepEqual(found("通院給付金の免責金額は1回5,000円です。1回あたりの支払限度額は3,000円です。", ja), []);
  });

  it("en: reports an excess over the most paid, per visit and per claim against a single item", () => {
    assert.deepEqual(found("The outpatient excess is $80 a visit, and the most we pay for a visit is $50.", en), ["$80>$50"]);
    assert.deepEqual(found("The personal belongings excess is $750 a claim, and the most we pay for a single item is $500.", en), ["$750>$500"]);
  });

  it("en: is silent for the corrected sentences and for bases that do not nest", () => {
    assert.deepEqual(found("The outpatient excess is $20 a visit, and the most we pay for a visit is $50.", en), []);
    assert.deepEqual(found("The personal belongings excess is $50 a claim, and the most we pay for a single item is $500.", en), []);
    assert.deepEqual(found("The hospital excess is $200 a year, and the most we pay for a visit is $50.", en), []);
  });

  it("says the words and both amounts in the message", () => {
    const message = (text: string, adapter: LanguageAdapter): string[] => {
      const rule = loadRules(adapter.id).find((definition) => definition.id === RULE);
      return rule === undefined ? [] : findings(text, adapter).map((finding) => messageOf(rule, finding, adapter.id));
    };
    assert.deepEqual(message("The outpatient excess is $80 a visit, and the most we pay for a visit is $50.", en), [
      "The excess of $80 is more than the most paid, $50: this benefit would never pay out",
    ]);
    assert.deepEqual(message("通院給付金の免責金額は1回5,000円、1回あたりの支払限度額は3,000円です。", ja), [
      "「免責金額」の5,000円が「支払限度額」の3,000円より大きく、この補償は支払われないことになります",
    ]);
  });
});

// The amounts come from the structure tree's quantities; these cases run every currency notation through the rule.
describe("deductible-exceeds-limit reads every currency notation", () => {
  const LATIN_WORD = /^[A-Za-z]/u;
  const notations = (adapter: LanguageAdapter): readonly LexiconEntry[] => {
    const entries = buildDocument("t.md", "# r\n", adapter).lexicons["currency-notation"] ?? [];
    assert.notEqual(entries.length, 0, `${adapter.id}: lexicon currency-notation`);
    return entries;
  };
  /** An amount in one notation, its mark touching the number or a space apart; a Latin unit after always a space apart. */
  const amountsOf = (adapter: LanguageAdapter, gap: string): ((value: string) => string)[] =>
    notations(adapter).map((notation) => {
      if (notation.position === "before") return (value: string) => `${notation.pattern}${gap}${value}`;
      const space = adapter.id === "en" || LATIN_WORD.test(notation.pattern) ? " " : gap;
      return (value: string) => `${value}${space}${notation.pattern}`;
    });
  const sentence = (adapter: LanguageAdapter, deductible: string, limit: string): string =>
    adapter.id === "ja"
      ? `免責金額は1回${deductible}、1回あたりの支払限度額は${limit}です。`
      : `The excess is ${deductible} a visit, and the most we pay for a visit is ${limit}.`;
  const detected = (text: string, adapter: LanguageAdapter): string[] =>
    deductibleExceedsLimit(buildDocument("t.md", `# 概要\n\n${text}\n`, adapter), { limit: 0 }).map(
      (finding) => `${String(finding.values["deductible"])}>${String(finding.values["limit"])}`,
    );
  const every = (gap: string) => [ja, en].flatMap((adapter) => amountsOf(adapter, gap).map((amount) => ({ adapter, amount })));

  it("reports a deductible over the limit, quoting each amount as written, its mark touching or a space apart", () => {
    [...every(""), ...every(" ")].forEach(({ adapter, amount }) => {
      const [larger, smaller] = [amount("5,000"), amount("3,000")];
      assert.deepEqual(detected(sentence(adapter, larger, smaller), adapter), [`${larger}>${smaller}`], `${adapter.id}: ${larger}`);
      assert.deepEqual(detected(sentence(adapter, smaller, larger), adapter), [], `${adapter.id}: ${smaller}`);
    });
  });

  it("does not read a signed amount", () => {
    const SIGNS = ["▲", "△", "-", "−"];
    [...every(""), ...every(" ")].forEach(({ adapter, amount }) => {
      const signed = SIGNS.flatMap((sign) => [`${sign}${amount("5,000")}`, amount("5,000").replace(/(?=\d)/u, sign)]);
      signed.forEach((deductible) => assert.deepEqual(detected(sentence(adapter, deductible, amount("3,000")), adapter), [], `${adapter.id}: ${deductible}`));
    });
  });
});
