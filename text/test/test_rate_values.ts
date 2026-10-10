import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import type { FactValue } from "../packages/chaff/src/facts/fact-values.ts";
import { basesAgree, isRate, joinsNextClause, rateHead, rateTail, type RateWords } from "../packages/chaff/src/facts/rate-values.ts";

// 率（百分率）のまわりの、値を変えない語（年、per year、（固定金利）、of the purchase price）。

const WORDS: RateWords = {
  units: ["%", "％", "percent"],
  notes: {
    period: [
      { pattern: "年", group: "year", position: "before" },
      { pattern: "per year", group: "year", position: "after" },
      { pattern: "a month", group: "month", position: "after" },
    ],
    kind: [
      { pattern: "の固定", group: "fixed", position: "after" },
      { pattern: "固定金利", group: "fixed", position: "after" },
      { pattern: "fixed", group: "fixed", position: "after" },
      { pattern: "variable", group: "variable", position: "after" },
    ],
    base: [{ pattern: "of the purchase price", group: "price", position: "after" }],
  },
  joiners: ["and does not", "and stays"],
};

/** source の中の最初の text を、単位 unit の数量として。 */
const valueAt = (source: string, text: string, unit = "%"): FactValue => {
  const start = source.indexOf(text);
  return { start, end: start + text.length, kind: "quantity", key: text, unit };
};

describe("isRate", () => {
  it("a quantity in a percent unit is a rate", () => {
    assert.equal(isRate(valueAt("3.6%", "3.6%"), WORDS), true);
    assert.equal(isRate(valueAt("3.6％", "3.6％", "％"), WORDS), true);
  });
  it("another unit, a date or a name is not", () => {
    assert.equal(isRate(valueAt("300円", "300円", "円"), WORDS), false);
    assert.equal(isRate({ ...valueAt("3.6%", "3.6%"), kind: "date" }, WORDS), false);
    assert.equal(isRate(valueAt("36", "36", ""), WORDS), false);
  });
});

describe("rateTail", () => {
  const tailOf = (source: string, text: string): string => {
    const tail = rateTail(source, valueAt(source, text), WORDS);
    return `${source.slice(tail.end)}|${tail.basis.join(",")}`;
  };

  it("passes a period, a kind, a base and a bracketed note, and keeps what they say", () => {
    assert.equal(tailOf("Rate: 4.8% per year (fixed)", "4.8%"), "|period:year,kind:fixed");
    assert.equal(tailOf("Fee rate: 4.0% of the purchase price", "4.0%"), "|base:price");
    assert.equal(tailOf("貸付利率：年3.6%（固定金利）", "3.6%"), "|kind:fixed");
    assert.equal(tailOf("貸付利率は年3.5%の固定で、変わりません。", "3.5%"), "で、変わりません。|kind:fixed");
    assert.equal(tailOf("分割手数料率：4.0%（商品代金に対して）", "4.0%"), "|note:商品代金に対して");
  });

  it("stops at a word that is not in the lexicon", () => {
    assert.equal(tailOf("Rate: 3.6% of applicants", "3.6%"), " of applicants|");
    assert.equal(tailOf("売上は3.6%増", "3.6%"), "増|");
    assert.equal(tailOf("Rate: 3.6% a yearly cap", "3.6%"), " a yearly cap|");
  });

  it("does not take a bracket that is not closed on the line, or has another bracket inside", () => {
    assert.equal(tailOf("Rate: 3.6% (fixed", "3.6%"), " (fixed|");
    assert.equal(tailOf("Rate: 3.6% (see (a))", "3.6%"), " (see (a))|");
    assert.equal(tailOf("Rate: 3.6% (fixed\nfor now)", "3.6%"), " (fixed\nfor now)|");
  });

  it("a bracket whose whole content is not a lexicon word is a note of its own", () => {
    assert.equal(tailOf("Rate: 3.6% (fixed for two years)", "3.6%"), "|note:fixed for two years");
    assert.equal(tailOf("Rate: 3.6% (Of Applicants)", "3.6%"), "|note:of applicants");
  });
});

describe("rateHead", () => {
  it("takes a period word off the end of the head", () => {
    assert.deepEqual(rateHead("貸付利率：年", WORDS), { head: "貸付利率：", basis: ["period:year"] });
  });
  it("leaves a head without one as it is", () => {
    assert.deepEqual(rateHead("貸付利率：", WORDS), { head: "貸付利率：", basis: [] });
    assert.deepEqual(rateHead("", WORDS), { head: "", basis: [] });
  });
});

describe("joinsNextClause", () => {
  const joins = (source: string): boolean => joinsNextClause(source, source.indexOf("%") + 1, WORDS);
  it("a phrase of the lexicon that says the value is said", () => {
    assert.equal(joins("The fee rate is 4.5% and does not change."), true);
    assert.equal(joins("The rate is 4.5%  and stays the same."), true);
  });
  it("anything else after and keeps the value open", () => {
    assert.equal(joins("The rate is 4.5% and 5% for members."), false);
    assert.equal(joins("The rate is 4.5% and up."), false);
    assert.equal(joins("Growth is 3.6% and rising."), false);
  });
  it("no joiner, or a joiner that is the head of a longer word", () => {
    assert.equal(joins("The rate is 4.5% for members."), false);
    assert.equal(joins("The rate is 4.5% and staysail"), false);
    assert.equal(joins("The rate is 4.5%"), false);
  });
});

describe("basesAgree", () => {
  it("agrees when one side says nothing, or both say the same", () => {
    assert.equal(basesAgree(undefined, undefined), true);
    assert.equal(basesAgree(["period:year"], undefined), true);
    assert.equal(basesAgree(["period:year"], ["kind:fixed"]), true);
    assert.equal(basesAgree(["period:year", "kind:fixed"], ["kind:fixed"]), true);
  });
  it("disagrees when both state the same kind of basis differently", () => {
    assert.equal(basesAgree(["period:year"], ["period:month"]), false);
    assert.equal(basesAgree(["kind:fixed"], ["period:year", "kind:variable"]), false);
  });
  it("a note outside the lexicon agrees only with the same note", () => {
    assert.equal(basesAgree(["note:men"], ["note:men"]), true);
    assert.equal(basesAgree(["note:men"], ["note:women"]), false);
    assert.equal(basesAgree(["note:men"], undefined), false);
    assert.equal(basesAgree(undefined, ["period:year", "note:men"]), false);
  });
});

const RULES = { "fact-conflict": "normal" } as const;

const found = (lines: readonly string[], adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", lines.join("\n"), adapter), loadRules(language), RULES, false, "business/report")
    .findings.filter((finding) => finding.rule === "fact-conflict")
    .map((finding) => `${String(finding.values["label"])}:${String(finding.values["value"])}≠${String(finding.values["other"])}`);

const foundJa = (...lines: string[]): string[] => found(["# 予定表", "", "## ご契約内容", "", ...lines], ja, "ja");
const foundEn = (...lines: string[]): string[] => found(["# Schedule", "", "## Loan details", "", ...lines], en, "en");

describe("fact-conflict: a rate with words around it", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("a list rate with a period and a note, against a sentence rate with a kind (ja)", () => {
    assert.deepEqual(foundJa("- 貸付利率：年3.6%（固定金利）", "", "貸付利率は年3.5%の固定で、お借入期間中は変わりません。"), ["貸付利率:3.5%≠3.6%"]);
    assert.deepEqual(foundJa("- 貸付利率：年3.6%（固定金利）", "", "貸付利率は年3.6%の固定で、お借入期間中は変わりません。"), []);
    assert.deepEqual(foundJa("- 分割手数料率：4.0%（商品代金に対して）", "", "分割手数料率は4.5%で、途中で変わることはありません。"), [
      "分割手数料率:4.5%≠4.0%",
    ]);
  });

  it("a list rate with a period and a note, against a sentence that goes on (en)", () => {
    assert.deepEqual(foundEn("- Interest rate: 4.8% per year (fixed)", "", "The interest rate is 4.9% per year and stays the same."), [
      "The interest rate:4.9%≠4.8%",
    ]);
    assert.deepEqual(foundEn("- Interest rate: 4.8% per year (fixed)", "", "The interest rate is 4.8% per year and stays the same."), []);
    assert.deepEqual(foundEn("- Fee rate: 4.0% of the purchase price", "", "The fee rate is 4.5% and does not change."), ["The fee rate:4.5%≠4.0%"]);
  });

  it("a percentage that is part of another measure stays silent", () => {
    assert.deepEqual(foundEn("- Approval rate: 3.6% of applicants", "", "The approval rate is 4.1% of loans."), []);
    assert.deepEqual(foundEn("- Approval rate: 3.6% (of applicants)", "", "The approval rate is 4.1%."), []);
    assert.deepEqual(foundEn("- Growth: 3.6% and rising.", "", "Growth is 4.1%."), []);
    assert.deepEqual(foundEn("- Growth: 3.6% higher", "", "Growth is 4.1% and up."), []);
    assert.deepEqual(foundJa("- 売上：前年比3.6%増", "", "売上は4.1%増です。"), []);
  });

  it("two rates of different items stay apart", () => {
    assert.deepEqual(foundJa("- 貸付利率：年3.6%（固定金利）", "- 分割手数料率：4.0%（商品代金に対して）"), []);
    assert.deepEqual(foundEn("- Interest rate: 4.8% per year (fixed)", "- Late fee rate: 1.5% a month"), []);
  });

  it("fixed and variable rates stay apart, whether the labels or the notes tell them apart", () => {
    assert.deepEqual(foundJa("- 固定金利：年1.8%", "- 変動金利：年0.9%"), []);
    assert.deepEqual(foundJa("- 貸付利率：年1.8%（固定金利）", "- 貸付利率：年0.9%（変動金利）"), []);
    assert.deepEqual(foundEn("- Fixed rate: 4.8% per year", "- Variable rate: 3.9% per year"), []);
    assert.deepEqual(foundEn("- Interest rate: 4.8% (fixed)", "- Interest rate: 3.9% (variable)"), []);
  });

  it("rates told apart by a note outside the lexicon stay apart; the same note is compared", () => {
    assert.deepEqual(foundEn("- Unemployment rate: 3.6% (men)", "- Unemployment rate: 4.1% (women)"), []);
    assert.deepEqual(foundEn("- Interest rate: 3.6% (introductory)", "", "Interest rate: 4.1%."), []);
    assert.deepEqual(foundJa("- 手数料率：4.0%（税込）", "- 手数料率：4.5%（税込）"), ["手数料率:4.5%≠4.0%"]);
  });

  it("rates of one item over different periods stay apart; a rate without a period is still compared", () => {
    assert.deepEqual(foundEn("- Interest rate: 0.5% a month", "- Interest rate: 6% per year"), []);
    assert.deepEqual(foundJa("- 遅延損害金の利率：月1.5%", "- 遅延損害金の利率：年14.6%"), []);
    assert.deepEqual(foundEn("- Interest rate: 4.8% per year", "", "The interest rate is 4.9%."), ["The interest rate:4.9%≠4.8%"]);
  });

  it("other values keep needing a plain end: an amount followed by per year is a condition", () => {
    assert.deepEqual(foundEn("- Fee: $300 per year", "", "The fee is $400."), []);
    assert.deepEqual(foundJa("- 会費：年3,000円", "", "会費は4,000円です。"), []);
  });
});
