import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { netAmountMismatch } from "../packages/chaff/src/detectors/net-amount-mismatch.ts";
import { allowedGap, amountOf, netMismatch, roleOf, type LabelledAmount, type NetRole, type NetWords } from "../packages/chaff/src/structure/net-amount.ts";

// 総額 − 控除合計 と差引額（net-amount-mismatch）。例は自作。

const RULE = "net-amount-mismatch";

const found = (text: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", `# 明細\n\n${text}\n`, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/proposal")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["written"])}:${String(finding.values["expected"])}`);

const detected = (text: string, adapter: LanguageAdapter): string[] =>
  netAmountMismatch(buildDocument("t.md", `# 明細\n\n${text}\n`, adapter), { limit: 0 }).map(
    (finding) => `${String(finding.values["written"])}:${String(finding.values["expected"])}`,
  );

const WORDS: NetWords = {
  labels: { gross: ["総支給額", "Gross pay"], deduction: ["控除合計", "Total deductions"], net: ["差引支給額", "Net pay"] },
  magnitudes: ["千", "万", "million"],
  percentUnits: ["%"],
};

const labelled = (role: NetRole, text: string, start = 0, note = ""): LabelledAmount[] => {
  const amount = amountOf(text, start, note, WORDS);
  return amount === undefined ? [] : [{ ...amount, role }];
};

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

describe("roleOf", () => {
  it("names a role only for a label that is the word alone, its note aside", () => {
    assert.equal(roleOf("総支給額", WORDS), "gross");
    assert.equal(roleOf("総支給額（円）", WORDS), "gross");
    assert.equal(roleOf("net pay", WORDS), "net");
    assert.equal(roleOf("Net pay (USD)", WORDS), "net");
  });

  it("names none for a longer label or another word", () => {
    assert.equal(roleOf("総支給額の累計", WORDS), undefined);
    assert.equal(roleOf("Net pay to date", WORDS), undefined);
    assert.equal(roleOf("", WORDS), undefined);
    assert.equal(roleOf("所得税", WORDS), undefined);
  });
});

describe("amountOf", () => {
  it("reads one plain amount with its marks", () => {
    assert.equal(amountOf("256,287円", 5, "", WORDS)?.value, 256287);
    assert.equal(amountOf("$4,301.01", 0, "", WORDS)?.decimals, 2);
    assert.equal(amountOf("1,200", 0, "", WORDS)?.unit, "||");
  });

  it("reads no percentage, signed, bracketed, empty or non-numeric value", () => {
    assert.equal(amountOf("12%", 0, "", WORDS), undefined);
    assert.equal(amountOf("-500円", 0, "", WORDS), undefined);
    assert.equal(amountOf("▲500円", 0, "", WORDS), undefined);
    assert.equal(amountOf("(1,200)", 0, "", WORDS), undefined);
    assert.equal(amountOf("", 0, "", WORDS), undefined);
    assert.equal(amountOf("—", 0, "", WORDS), undefined);
    assert.equal(amountOf("1,200円〜1,500円", 0, "", WORDS), undefined);
  });
});

describe("allowedGap", () => {
  const read = (text: string): NonNullable<ReturnType<typeof amountOf>> => {
    const amount = amountOf(text, 0, "", WORDS);
    assert.ok(amount !== undefined);
    return amount;
  };

  it("allows less than half the last digit for amounts with a currency mark", () => {
    assert.equal(allowedGap([read("100円"), read("10円"), read("90円")], WORDS), 0.5);
    assert.ok(allowedGap([read("$1.00"), read("$0.10"), read("$0.90")], WORDS) < 0.01);
  });

  it("allows one step for amounts in a magnitude word or with no mark", () => {
    assert.equal(allowedGap([read("100千円"), read("10千円"), read("90千円")], WORDS), 1.5);
    assert.equal(allowedGap([read("100"), read("10"), read("90")], WORDS), 1.5);
  });
});

describe("netMismatch", () => {
  const scope = (gross: string, deduction: string, net: string): LabelledAmount[] => [
    ...labelled("gross", gross, 0),
    ...labelled("deduction", deduction, 20),
    ...labelled("net", net, 40),
  ];

  it("is silent when the net is the gross minus the deductions", () => {
    assert.equal(netMismatch(scope("327,200円", "70,913円", "256,287円"), WORDS), undefined);
    assert.equal(netMismatch(scope("$5,860.00", "$1,558.99", "$4,301.01"), WORDS), undefined);
    assert.equal(netMismatch(scope("327千円", "71千円", "257千円"), WORDS), undefined);
  });

  it("gives the subtraction, written as the net is, when it does not agree", () => {
    assert.deepEqual(netMismatch(scope("327,200円", "70,913円", "265,287円"), WORDS), {
      offset: 40,
      values: { written: "265,287円", expected: "256,287円" },
    });
    assert.deepEqual(netMismatch(scope("$5,860.00", "$1,558.99", "$4,310.01"), WORDS)?.values, { written: "$4,310.01", expected: "$4,301.01" });
    assert.deepEqual(netMismatch(scope("327200円", "70913円", "256288円"), WORDS)?.values, { written: "256288円", expected: "256287円" });
    assert.deepEqual(netMismatch(scope("327千円", "71千円", "254千円"), WORDS)?.values, { written: "254千円", expected: "256千円" });
  });

  it("writes the subtraction in full-width digits when the net is", () => {
    assert.deepEqual(netMismatch(scope("１２，０００円", "２，０００円", "９，０００円"), WORDS)?.values, {
      written: "９，０００円",
      expected: "１０，０００円",
    });
  });

  it("is silent when a role is missing, written twice differently, or the units differ", () => {
    assert.equal(netMismatch([...labelled("gross", "100円"), ...labelled("net", "50円")], WORDS), undefined);
    assert.equal(netMismatch([...scope("100円", "10円", "50円"), ...labelled("gross", "60円")], WORDS), undefined);
    assert.equal(netMismatch(scope("100円", "$10", "50円"), WORDS), undefined);
    assert.equal(netMismatch(scope("100円", "10千円", "50円"), WORDS), undefined);
    assert.equal(netMismatch(scope("100円", "200円", "0円"), WORDS), undefined);
    assert.equal(netMismatch([], WORDS), undefined);
  });

  it("reads a role written twice with the same value as one", () => {
    assert.deepEqual(netMismatch([...scope("100円", "10円", "80円"), ...labelled("gross", "100円")], WORDS)?.values, { written: "80円", expected: "90円" });
  });
});

describe("net-amount-mismatch in documents", () => {
  const headerTable = (net: string): string => ["| 総支給額 | 控除合計 | 差引支給額 |", "| --- | --- | --- |", `| 327,200円 | 70,913円 | ${net} |`].join("\n");
  const rowTable = (net: string): string =>
    ["| Item | Amount |", "| --- | --- |", "| Gross pay | $1,661.00 |", "| Total deductions | $264.59 |", `| Net pay | ${net} |`].join("\n");

  it("reports a table whose header names the three columns", () => {
    assert.deepEqual(found(headerTable("265,287円"), ja), ["265,287円:256,287円"]);
    assert.deepEqual(found(headerTable("256,287円"), ja), []);
  });

  it("reports a table whose first column names the three rows", () => {
    assert.deepEqual(found(rowTable("$1,369.41"), en), ["$1,369.41:$1,396.41"]);
    assert.deepEqual(found(rowTable("$1,396.41"), en), []);
  });

  it("reports the labelled lines of a section", () => {
    const list = (net: string): string => ["- 総支給額：117,380円", "- 控除合計：3,074円", `- 差引支給額：${net}`].join("\n");
    assert.deepEqual(found(list("114,036円"), ja), ["114,036円:114,306円"]);
    assert.deepEqual(found(list("114,306円"), ja), []);
    const lines = (net: string): string => ["Gross pay: $1,661.00", "", "Total deductions: $264.59", "", `Net pay: ${net}`].join("\n");
    assert.deepEqual(found(lines("$1,369.41"), en), ["$1,369.41:$1,396.41"]);
    assert.deepEqual(found(lines("$1,396.41"), en), []);
  });

  it("does not join names from different sections or tables", () => {
    const split = ["Gross pay: $1,661.00", "", "## Deductions", "", "Total deductions: $264.59", "", "Net pay: $1,369.41"].join("\n");
    assert.deepEqual(detected(split, en), []);
    const tables = [
      "| Earning | Amount |",
      "| --- | --- |",
      "| Gross pay | $1,661.00 |",
      "",
      "| Deduction | Amount |",
      "| --- | --- |",
      "| Total deductions | $264.59 |",
      "| Net pay | $1,369.41 |",
    ].join("\n");
    assert.deepEqual(detected(tables, en), []);
  });

  it("is silent when a name is written twice with different amounts", () => {
    const twice = ["- 総支給額：117,380円", "- 控除合計：3,074円", "- 差引支給額：114,036円", "- 総支給額：120,000円"].join("\n");
    assert.deepEqual(detected(twice, ja), []);
  });

  it("leaves a table written without leading pipes to the table reader", () => {
    const pipeless = ["Item | Amount", "--- | ---", "Gross pay: $1,661.00 | x", "Total deductions: $264.59 | x", "Net pay: $1,369.41 | x"].join("\n");
    assert.deepEqual(detected(pipeless, en), []);
  });

  it("does not read amounts in sentences", () => {
    assert.deepEqual(detected("Gross pay was $1,661.00, total deductions were $264.59 and net pay was $1,369.41.", en), []);
    assert.deepEqual(detected("総支給額は117,380円、控除合計は3,074円で、差引支給額は114,036円です。", ja), []);
  });

  it("reads each row of a header-labelled table with many rows", () => {
    const months = [
      "| 月 | 総支給額 | 控除合計 | 差引支給額 |",
      "| --- | --- | --- | --- |",
      "| 8月 | 300,000円 | 60,000円 | 240,000円 |",
      "| 9月 | 310,000円 | 61,000円 | 259,000円 |",
    ].join("\n");
    assert.deepEqual(detected(months, ja), ["259,000円:249,000円"]);
  });

  it("does not read a table whose rows do not line up with each other", () => {
    const wideRow = ["| 総支給額 | 控除合計 | 差引支給額 |", "| --- | --- | --- |", "| 327,200円 | 70,913円 | 999円 | 256,287円 |"].join("\n");
    assert.deepEqual(detected(wideRow, ja), []);
    const shortRow = [
      "| Item | August | September |",
      "| --- | --- | --- |",
      "| Gross pay | $100.00 | $200.00 |",
      "| Total deductions | $10.00 | $20.00 |",
      "| Net pay | $180.00 |",
    ].join("\n");
    assert.deepEqual(detected(shortRow, en), []);
  });

  it("allows one step of rounding in a table without currency marks", () => {
    const rounded = (net: string): string =>
      ["| Item | FY2025 |", "| --- | --- |", "| Gross amount | 1,200 |", "| Total deductions | 301 |", `| Net amount | ${net} |`].join("\n");
    assert.deepEqual(detected(rounded("900"), en), []);
    assert.deepEqual(detected(rounded("896"), en), ["896:899"]);
  });
});
