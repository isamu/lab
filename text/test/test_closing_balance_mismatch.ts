import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { amountOf, isExact, type NetAmount } from "../packages/chaff/src/structure/net-amount.ts";
import {
  balanceRoleOf,
  closingMismatch,
  isDatedNote,
  withHeadingUnit,
  type BalanceAmount,
  type BalanceRole,
  type BalanceWords,
} from "../packages/chaff/src/structure/closing-balance.ts";

// 前月末残高 ＋ 入金合計 − 出金合計 と当月末残高（closing-balance-mismatch）。例の明細はすべて自作。

const RULE = "closing-balance-mismatch";

const found = (text: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", `# 明細\n\n${text}\n`, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/proposal")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["written"])}:${String(finding.values["expected"])}`);

const lines = (rows: readonly string[]): string => rows.join("\n\n");

const WORDS: BalanceWords = {
  labels: {
    opening: ["前月末残高", "Opening balance"],
    inflow: ["お預入れ合計", "Total deposits"],
    outflow: ["お引出し合計", "Total withdrawals"],
    closing: ["当月末残高", "Closing balance"],
  },
  magnitudes: ["千", "million"],
  percentUnits: ["%"],
};

const labelled = (role: BalanceRole, text: string, start = 0): BalanceAmount[] => {
  const amount = amountOf(text, start, "", WORDS);
  return amount === undefined ? [] : [{ ...amount, role }];
};

const four = (opening: string, inflow: string, outflow: string, closing: string): BalanceAmount[] => [
  ...labelled("opening", opening),
  ...labelled("inflow", inflow),
  ...labelled("outflow", outflow),
  ...labelled("closing", closing, 1),
];

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

describe("balanceRoleOf", () => {
  it("names a role for a label that is the word alone, its note aside", () => {
    assert.equal(balanceRoleOf("前月末残高", WORDS), "opening");
    assert.equal(balanceRoleOf("当月末残高（円）", WORDS), "closing");
    assert.equal(balanceRoleOf("total deposits", WORDS), "inflow");
    assert.equal(balanceRoleOf("Total withdrawals (USD)", WORDS), "outflow");
  });

  it("names none for a longer label or another word", () => {
    assert.equal(balanceRoleOf("前月末残高の内訳", WORDS), undefined);
    assert.equal(balanceRoleOf("Closing balance to date", WORDS), undefined);
    assert.equal(balanceRoleOf("残高", WORDS), undefined);
    assert.equal(balanceRoleOf("", WORDS), undefined);
  });
});

describe("closingMismatch", () => {
  it("passes a closing balance that is opening + inflow − outflow", () => {
    assert.equal(closingMismatch(four("412,350円", "285,400円", "245,530円", "452,220円"), WORDS), undefined);
    assert.equal(closingMismatch(four("$2,418.36", "$2,941.80", "$3,203.60", "$2,156.56"), WORDS), undefined);
  });

  it("reports a closing balance that is not, with the sum written the way the balance is", () => {
    assert.deepEqual(closingMismatch(four("412,350円", "285,400円", "245,530円", "425,220円"), WORDS)?.values, {
      written: "425,220円",
      expected: "452,220円",
    });
    assert.deepEqual(closingMismatch(four("$2,418.36", "$2,941.80", "$3,203.60", "$2,165.56"), WORDS)?.values, {
      written: "$2,165.56",
      expected: "$2,156.56",
    });
    assert.equal(closingMismatch(four("412,350円", "285,400円", "245,530円", "452,221円"), WORDS)?.offset, 1);
  });

  it("compares nothing when a role is missing or named twice", () => {
    const whole = four("412,350円", "285,400円", "245,530円", "425,220円");
    assert.equal(closingMismatch(whole.slice(1), WORDS), undefined);
    assert.equal(closingMismatch(whole.slice(0, 3), WORDS), undefined);
    assert.equal(closingMismatch([...whole, ...labelled("inflow", "285,400円")], WORDS), undefined);
    assert.equal(closingMismatch([...whole, ...labelled("closing", "425,220円")], WORDS), undefined);
    assert.equal(closingMismatch([], WORDS), undefined);
  });

  it("compares nothing across units or below zero", () => {
    assert.equal(closingMismatch(four("412,350円", "285,400円", "245,530円", "$425,220"), WORDS), undefined);
    assert.equal(closingMismatch(four("412千円", "285,400円", "245,530円", "425,220円"), WORDS), undefined);
    assert.equal(closingMismatch(four("100円", "50円", "300円", "0円"), WORDS), undefined);
  });

  it("lets rounded amounts be off by two steps of their last digit, and no more", () => {
    assert.equal(closingMismatch(four("412千円", "285千円", "245千円", "454千円"), WORDS), undefined);
    assert.equal(closingMismatch(four("412千円", "285千円", "245千円", "450千円"), WORDS), undefined);
    assert.deepEqual(closingMismatch(four("412千円", "285千円", "245千円", "455千円"), WORDS)?.values, { written: "455千円", expected: "452千円" });
  });
});

describe("closing-balance-mismatch: label lines of one section", () => {
  const JA = ["前月末残高：412,350円", "お預入れ合計：285,400円", "お引出し合計：245,530円"];
  const EN = ["Opening balance: $2,418.36", "Total deposits: $2,941.80", "Total withdrawals: $3,203.60"];

  it("reports a wrong closing balance", () => {
    assert.deepEqual(found(lines([...JA, "当月末残高：425,220円"]), ja), ["425,220円:452,220円"]);
    assert.deepEqual(found(lines([...EN, "Closing balance: $2,165.56"]), en), ["$2,165.56:$2,156.56"]);
    assert.deepEqual(found(lines(["- 前月繰越：412,350円", "- 入金合計：285,400円", "- 出金合計：245,530円", "- 次月繰越：425,220円"]), ja), [
      "425,220円:452,220円",
    ]);
  });

  it("passes a right one", () => {
    assert.deepEqual(found(lines([...JA, "当月末残高：452,220円"]), ja), []);
    assert.deepEqual(found(lines([...EN, "Closing balance: $2,156.56"]), en), []);
  });

  it("does not add up names spread over two sections", () => {
    assert.deepEqual(found(lines([...JA.slice(0, 2), "## 出金", ...JA.slice(2), "当月末残高：425,220円"]), ja), []);
  });

  it("does not compare a section that names a balance twice (two months)", () => {
    assert.deepEqual(found(lines([...JA, "当月末残高：425,220円", "前月末残高：300,000円"]), ja), []);
  });

  it("does not read a card statement's previous and new balance", () => {
    assert.deepEqual(found(lines(["Previous balance: $500.00", "Credits: $100.00", "Debits: $50.00", "New balance: $450.00"]), en), []);
    assert.deepEqual(found(lines(["Opening balance: $500.00", "Credits: $100.00", "Debits: $50.00", "Closing balance: $450.00"]), en), []);
  });
});

describe("closing-balance-mismatch: tables", () => {
  it("reads a summary table labelled in its first column, column by column", () => {
    const table = [
      "| | 8月 | 9月 |",
      "| --- | --- | --- |",
      "| 前月末残高 | 412,350円 | 452,220円 |",
      "| お預入れ合計 | 285,400円 | 100,000円 |",
      "| お引出し合計 | 245,530円 | 50,000円 |",
      "| 当月末残高 | 452,220円 | 520,220円 |",
    ];
    assert.deepEqual(found(table.join("\n"), ja), ["520,220円:502,220円"]);
  });

  it("reads a table whose header names the four, row by row", () => {
    const table = [
      "| Month | Opening balance | Total deposits | Total withdrawals | Closing balance |",
      "| --- | --- | --- | --- | --- |",
      "| July | $1,000.00 | $500.00 | $200.00 | $1,300.00 |",
      "| August | $1,300.00 | $400.00 | $100.00 | $1,500.00 |",
    ];
    assert.deepEqual(found(table.join("\n"), en), ["$1,500.00:$1,600.00"]);
  });

  it("leaves a transaction table with a running balance alone", () => {
    const table = [
      "| 日付 | お取引内容 | お預入れ | お引出し | 残高 |",
      "| --- | --- | --- | --- | --- |",
      "| 2026年8月1日 | 前月繰越 | | | 412,350円 |",
      "| 2026年8月5日 | ATM お引出し | | 30,000円 | 392,350円 |",
      "| 2026年8月31日 | 次月繰越 | | | 382,350円 |",
    ];
    assert.deepEqual(found(table.join("\n"), ja), []);
  });
});

describe("closing-balance-mismatch: points statements", () => {
  const JA = ["- 前月末の残高：2,140ポイント", "- 今月の獲得ポイント：860ポイント", "- 今月の利用ポイント：1,500ポイント"];
  const EN = ["- Previous balance: 2,140 points", "- Points earned: 860 points", "- Points used: 1,500 points"];

  it("reports a wrong balance of points, and passes a right one", () => {
    assert.deepEqual(found(lines([...JA, "- 今月末の残高：1,050ポイント"]), ja), ["1,050ポイント:1,500ポイント"]);
    assert.deepEqual(found(lines([...JA, "- 今月末の残高：1,500ポイント"]), ja), []);
    assert.deepEqual(found(lines([...EN, "- New balance: 1,050 points"]), en), ["1,050 points:1,500 points"]);
    assert.deepEqual(found(lines([...EN, "- New balance: 1,500 points"]), en), []);
  });

  it("reads a two-column table of points", () => {
    const table = ["| Item | Points |", "| --- | --- |", "| Previous balance | 9,200 |", "| Points earned | 1,300 |", "| Points used | 5,000 |"];
    assert.deepEqual(found([...table, "| New balance | 5,050 |"].join("\n"), en), ["5,050:5,500"]);
    assert.deepEqual(found([...table, "| New balance | 5,500 |"].join("\n"), en), []);
  });

  it("never compares points with yen or dollars", () => {
    assert.deepEqual(found(lines([...JA.slice(0, 2), "- 今月の利用ポイント：1,500円", "- 今月末の残高：1,050ポイント"]), ja), []);
    assert.deepEqual(found(lines(["- Previous balance: $2,140.00", ...EN.slice(1), "- New balance: $1,050.00"]), en), []);
    assert.deepEqual(found(lines(["- 前月末の残高：2,140pt", ...JA.slice(1), "- 今月末の残高：1,050pt"]), ja), []);
  });

  it("leaves a card statement's previous and new balance alone when no points flow is named", () => {
    assert.deepEqual(found(lines(["Previous balance: $500.00", "Payments: $100.00", "Purchases: $50.00", "New balance: $450.00"]), en), []);
  });
});

describe("closing-balance-mismatch: a treasurer's carry-over", () => {
  const JA = ["| 区分 | 金額 |", "| --- | --- |", "| 前年度繰越金 | 21,300円 |", "| 本年度の収入 | 64,000円 |", "| 本年度の支出 | 58,750円 |"];
  const EN = [
    "| Item | Amount |",
    "| --- | --- |",
    "| Balance brought forward | $410.20 |",
    "| Add: income for the year | $980.00 |",
    "| Less: expenditure for the year | $1,015.50 |",
  ];

  it("reads a carry-over table", () => {
    assert.deepEqual(found([...JA, "| 次年度繰越金 | 25,650円 |"].join("\n"), ja), ["25,650円:26,550円"]);
    assert.deepEqual(found([...JA, "| 次年度繰越金 | 26,550円 |"].join("\n"), ja), []);
    assert.deepEqual(found([...EN, "| Balance carried forward | $347.40 |"].join("\n"), en), ["$347.40:$374.70"]);
    assert.deepEqual(found([...EN, "| Balance carried forward | $374.70 |"].join("\n"), en), []);
  });

  it("does not read the carry-over sentence, which names no opening amount", () => {
    assert.deepEqual(found("次年度繰越金は、収入合計120,000円から支出合計95,000円を差し引いた52,000円です。", ja), []);
  });
});

describe("closing-balance-mismatch: dated labels and a unit in the column heading", () => {
  const AS_OF = ["時点", "現在", "as of", "as at"];
  const read = (text: string): NetAmount => {
    const amount = amountOf(text, 0, "", WORDS);
    assert.ok(amount !== undefined);
    return amount;
  };
  const JA = ["| 項目 | ポイント |", "| --- | --- |", "| 前回の残高（2026年6月30日時点） | 18,450 |", "| 今回の獲得 | 4,960 |", "| 今回の利用 | 10,000 |"];
  const EN = [
    "| Item | Points |",
    "| --- | --- |",
    "| Previous balance (as of June 30, 2026) | 18,450 |",
    "| Points earned | 4,960 |",
    "| Points used | 10,000 |",
  ];

  it("reads a bracketed note naming the day a balance is taken on as a date", () => {
    assert.equal(isDatedNote("（2026年6月30日時点）", AS_OF), true);
    assert.equal(isDatedNote("（9月30日現在）", AS_OF), true);
    assert.equal(isDatedNote("(as of June 30, 2026)", AS_OF), true);
    assert.equal(isDatedNote("(As at 30 June 2026)", AS_OF), true);
  });

  it("does not read a unit, a note without a date, or a date without an as-of word as a dated note", () => {
    assert.equal(isDatedNote("（千円）", AS_OF), false);
    assert.equal(isDatedNote("(USD)", AS_OF), false);
    assert.equal(isDatedNote("（時点）", AS_OF), false);
    assert.equal(isDatedNote("(2026)", AS_OF), false);
    assert.equal(isDatedNote("", AS_OF), false);
    assert.equal(isDatedNote("（2026年6月30日時点）", []), false);
  });

  it("gives a bare number the unit of a word heading, still read as possibly rounded", () => {
    assert.equal(withHeadingUnit(read("14,310"), "ポイント").unit, read("4,960ポイント").unit);
    assert.equal(withHeadingUnit(read("14,310"), "Points").unit, read("4,960 points").unit);
    assert.equal(isExact(withHeadingUnit(read("14,310"), "ポイント"), WORDS), false);
  });

  it("leaves a written unit, a heading with a digit or a bracket, and no heading as they are", () => {
    assert.equal(withHeadingUnit(read("4,960ポイント"), "金額").unit, read("4,960ポイント").unit);
    assert.equal(withHeadingUnit(read("14,310"), "2026年9月").unit, read("14,310").unit);
    assert.equal(withHeadingUnit(read("14,310"), "金額（千円）").unit, read("14,310").unit);
    assert.equal(withHeadingUnit(read("14,310"), "").unit, read("14,310").unit);
    assert.equal(withHeadingUnit(read("14,310"), undefined).unit, read("14,310").unit);
  });

  it("compares dated and undated rows of bare numbers, and passes a right balance", () => {
    assert.deepEqual(found([...JA, "| 今回の残高（2026年9月30日時点） | 14,310 |"].join("\n"), ja), ["14,310:13,410"]);
    assert.deepEqual(found([...JA, "| 今回の残高（2026年9月30日時点） | 13,410 |"].join("\n"), ja), []);
    assert.deepEqual(found([...EN, "| New balance (as of September 30, 2026) | 14,310 |"].join("\n"), en), ["14,310:13,410"]);
    assert.deepEqual(found([...EN, "| New balance (as of September 30, 2026) | 13,410 |"].join("\n"), en), []);
  });

  it("reads dated label lines of a section", () => {
    const section = ["- 前回の残高（6月30日現在）：18,450", "- 今回の獲得：4,960", "- 今回の利用：10,000"];
    assert.deepEqual(found(lines([...section, "- 今回の残高（9月30日現在）：14,310"]), ja), ["14,310:13,410"]);
    assert.deepEqual(found(lines([...section, "- 今回の残高（9月30日現在）：13,410"]), ja), []);
  });

  it("compares bare numbers with numbers written in the unit their column heading names", () => {
    const mixed = [...JA.slice(0, 3), "| 今回の獲得 | 4,960ポイント |", "| 今回の利用 | 10,000ポイント |"];
    assert.deepEqual(found([...mixed, "| 今回の残高（2026年9月30日時点） | 14,310 |"].join("\n"), ja), ["14,310:13,410"]);
    assert.deepEqual(found([...mixed, "| 今回の残高（2026年9月30日時点） | 13,410 |"].join("\n"), ja), []);
    const english = [...EN.slice(0, 3), "| Points earned | 4,960 points |", "| Points used | 10,000 points |"];
    assert.deepEqual(found([...english, "| New balance | 14,310 |"].join("\n"), en), ["14,310:13,410"]);
  });

  it("keeps apart a heading that is not the written unit, and a note that is a unit", () => {
    const amounts = [
      "| Item | Amount |",
      "| --- | --- |",
      "| Previous balance | 18,450 |",
      "| Points earned | 4,960 points |",
      "| Points used | 10,000 points |",
    ];
    assert.deepEqual(found([...amounts, "| New balance | 14,310 |"].join("\n"), en), []);
    const thousands = [...JA.slice(0, 2), "| 前回の残高（千ポイント） | 18 |", "| 今回の獲得 | 4,960 |", "| 今回の利用 | 10,000 |"];
    assert.deepEqual(found([...thousands, "| 今回の残高 | 14,310 |"].join("\n"), ja), []);
    const datedThousands = [...JA.slice(0, 2), "| 前回の残高（2026年6月30日時点・千ポイント） | 18 |", "| 今回の獲得 | 4,960 |", "| 今回の利用 | 10,000 |"];
    assert.deepEqual(found([...datedThousands, "| 今回の残高 | 14,310 |"].join("\n"), ja), []);
    const datedCurrency = [
      ...EN.slice(0, 2),
      "| Previous balance (USD, as of June 30, 2026) | 18,450 |",
      "| Points earned | 4,960 |",
      "| Points used | 10,000 |",
    ];
    assert.deepEqual(found([...datedCurrency, "| New balance | 14,310 |"].join("\n"), en), []);
    const datedScale = [
      ...EN.slice(0, 2),
      "| Previous balance (thousand points, as of June 30, 2026) | 18 |",
      "| Points earned | 4,960 |",
      "| Points used | 10,000 |",
    ];
    assert.deepEqual(found([...datedScale, "| New balance | 14,310 |"].join("\n"), en), []);
  });

  it("leaves a dated card statement alone when no points flow is named", () => {
    const card = [
      "| Item | Amount |",
      "| --- | --- |",
      "| Previous balance (as of June 30, 2026) | $500.00 |",
      "| Payments | $100.00 |",
      "| Purchases | $50.00 |",
    ];
    assert.deepEqual(found([...card, "| New balance (as of July 31, 2026) | $450.00 |"].join("\n"), en), []);
  });
});
