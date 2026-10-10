import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import type { ChangeTable } from "../packages/chaff/src/structure/change-rate-table.ts";
import { balanceColumnsOf, runningBalanceMismatches, type BalanceWord } from "../packages/chaff/src/structure/running-balance.ts";

// 残高の列のある表の、前の行からの足し引きの食い違い（running-balance-mismatch）。例の表は自作。

const RULE = "running-balance-mismatch";

const COLUMNS: readonly BalanceWord[] = [
  { pattern: "お支払日", role: "date" },
  { pattern: "date", role: "date" },
  { pattern: "回", role: "sequence" },
  { pattern: "no.", role: "sequence" },
  { pattern: "残高", role: "balance" },
  { pattern: "balance", role: "balance" },
  { pattern: "利息", role: "interest" },
  { pattern: "interest", role: "interest" },
  { pattern: "元金", role: "principal" },
  { pattern: "principal", role: "principal" },
  { pattern: "入金", role: "in" },
  { pattern: "deposit", role: "in" },
  { pattern: "出金", role: "out" },
  { pattern: "withdrawal", role: "out" },
  { pattern: "支払額", role: "payment" },
  { pattern: "payment", role: "payment" },
];
const WORDS = { columns: COLUMNS, totalLabels: ["合計", "Total"] };

/** A table written as rows of cell texts, with offsets counted along one line per row. */
const tableOf = (rows: readonly (readonly string[])[]): ChangeTable => {
  const lines = rows.map((texts, line) =>
    texts.map((text, index) => {
      const start = line * 1000 + index * 100;
      return { start, end: start + text.length, text };
    }),
  );
  const [header = [], ...body] = lines;
  return { header, rows: body };
};

/** Each issue as "row:written→computed", the row counted from the first body row as 1. */
const issues = (rows: readonly (readonly string[])[]): string[] =>
  runningBalanceMismatches([tableOf(rows)], WORDS).map(
    (issue) => `${String(Math.floor(issue.offset / 1000))}:${String(issue.values["balance"])}→${String(issue.values["computed"])}`,
  );

const LOAN_HEADER = ["回", "お支払日", "お支払額", "うち元金", "うち利息", "お支払後の残高"];
const loanRow = (no: string, principal: string, balance: string): string[] => [no, "2026年11月27日", "32,826円", principal, "5,400円", balance];

describe("running-balance-mismatch: the columns the headings name", () => {
  it("a loan with a principal column moves by the principal; date, interest and payment columns are not the movement", () => {
    assert.deepEqual(balanceColumnsOf(LOAN_HEADER, COLUMNS), { kind: "loan", balance: 5, movement: 3, sequence: 0 });
  });
  it("without a principal or interest column the payment is the movement; 'Payment date' is a date", () => {
    assert.deepEqual(balanceColumnsOf(["No.", "Payment date", "Payment", "Balance after payment"], COLUMNS), {
      kind: "loan",
      balance: 3,
      movement: 2,
      sequence: 0,
    });
  });
  it("a ledger moves by deposits and withdrawals, either of which may be the only one", () => {
    assert.deepEqual(balanceColumnsOf(["Date", "Deposit", "Withdrawal", "Balance"], COLUMNS), { kind: "ledger", balance: 3, in: 1, out: 2 });
    assert.deepEqual(balanceColumnsOf(["Date", "Withdrawal", "Balance"], COLUMNS), { kind: "ledger", balance: 2, out: 1 });
  });
  it("names no columns when a part is missing, doubled or of both kinds", () => {
    assert.equal(balanceColumnsOf(["回", "お支払額", "うち利息", "残高"], COLUMNS), undefined, "interest but no principal");
    assert.equal(balanceColumnsOf(["回", "お支払額", "うち元金"], COLUMNS), undefined, "no balance");
    assert.equal(balanceColumnsOf(["回", "元金", "残高", "残高"], COLUMNS), undefined, "two balances");
    assert.equal(balanceColumnsOf(["回", "元金", "元金", "残高"], COLUMNS), undefined, "two principals");
    assert.equal(balanceColumnsOf(["Date", "Deposit", "Payment", "Balance"], COLUMNS), undefined, "loan and ledger");
    assert.equal(balanceColumnsOf(["Date", "Deposit/Withdrawal", "Balance"], COLUMNS), undefined, "one column for both ways: the sign is unread");
    assert.equal(balanceColumnsOf(["Account", "Deposit", "Withdrawal", "Balance"], COLUMNS), undefined, "no date or row number: one row per account");
    assert.equal(balanceColumnsOf(["Loan", "Principal", "Balance"], COLUMNS), undefined, "one row per loan");
    assert.equal(balanceColumnsOf(["A", "B", "C"], COLUMNS), undefined, "no heading words: position alone decides nothing");
    assert.equal(balanceColumnsOf([], COLUMNS), undefined);
  });
});

describe("running-balance-mismatch: the chain", () => {
  const clean = [
    LOAN_HEADER,
    loanRow("1", "27,426円", "1,772,574円"),
    loanRow("2", "27,508円", "1,745,066円"),
    loanRow("3", "27,591円", "1,717,475円"),
    loanRow("4", "27,674円", "1,689,801円"),
  ];
  it("is silent on a schedule that adds up", () => {
    assert.deepEqual(issues(clean), []);
  });
  it("reports a balance off the chain, in the cell's own notation", () => {
    const planted = clean.map((row, index) => (index === 4 ? loanRow("4", "27,674円", "1,698,801円") : row));
    assert.deepEqual(issues(planted), ["4:1,698,801円→1,689,801円"]);
  });
  it("reports only the first break: a slip in row 2's balance makes row 3 fail too, and only row 2 is named", () => {
    const slipped = clean.map((row, index) => (index === 2 ? loanRow("2", "27,508円", "1,754,066円") : row));
    assert.deepEqual(issues(slipped), ["2:1,754,066円→1,745,066円"]);
  });
  it("a slip in the principal is reported on its row", () => {
    const slipped = clean.map((row, index) => (index === 3 ? loanRow("3", "27,519円", "1,717,475円") : row));
    assert.deepEqual(issues(slipped), ["3:1,717,475円→1,717,547円"]);
  });
  it("lets each written figure stand for half its last digit, and no more", () => {
    const rows = [
      ["No.", "Principal", "Balance"],
      ["1", "$10.00", "$90.00"],
      ["2", "$10.00", "$80.01"],
    ];
    assert.deepEqual(issues(rows), [], "a cent off is within the rounding of three figures");
    const off = [
      ["No.", "Principal", "Balance"],
      ["1", "$10.00", "$90.00"],
      ["2", "$10.00", "$80.02"],
    ];
    assert.deepEqual(issues(off), ["2:$80.02→$80.00"]);
    const whole = [
      ["No.", "Principal", "Balance"],
      ["1", "$10", "$90"],
      ["2", "$10", "$81"],
    ];
    assert.deepEqual(issues(whole), [], "whole dollars stand for a dollar's rounding");
  });
  it("a total row neither breaks the order nor hides a slip above it", () => {
    const rows = [
      ["No.", "Principal", "Balance"],
      ["1", "100", "900"],
      ["2", "100", "700"],
      ["Total", "200", "1,600"],
    ];
    assert.deepEqual(issues(rows), ["2:700→800"]);
  });
  it("allows rounding only, however large the amounts", () => {
    const rows = [
      ["No.", "Principal", "Balance"],
      ["1", "$0", "$1,000,000,000,000"],
      ["2", "$2,000", "$999,999,999,000"],
    ];
    assert.deepEqual(issues(rows), ["2:$999,999,999,000→$999,999,998,000"]);
  });
  it("writes a negative computed balance with its sign before the currency mark", () => {
    const rows = [
      ["No.", "Principal", "Balance"],
      ["1", "$0", "$50"],
      ["2", "$60", "$0"],
    ];
    assert.deepEqual(issues(rows), ["2:$0→-$10"]);
  });
  it("subtracts the whole payment when there is no interest column", () => {
    const rows = [
      ["No.", "Payment date", "Payment", "Balance after payment"],
      ["1", "Nov 10", "$104.00", "$2,392.00"],
      ["2", "Dec 10", "$104.00", "$2,298.00"],
    ];
    assert.deepEqual(issues(rows), ["2:$2,298.00→$2,288.00"]);
  });
  it("adds deposits and takes withdrawals in a ledger; a blank or a dash is zero", () => {
    const rows = [
      ["Date", "Deposit", "Withdrawal", "Balance"],
      ["Oct 1", "", "", "1,000"],
      ["Oct 2", "500", "-", "1,500"],
      ["Oct 3", "", "200", "1,300"],
      ["Oct 4", "100", "50", "1,350"],
    ];
    assert.deepEqual(issues(rows), []);
    assert.deepEqual(issues(rows.map((row, index) => (index === 3 ? ["Oct 3", "", "200", "1,200"] : row))), ["3:1,200→1,300"]);
  });
});

describe("running-balance-mismatch: what is not compared", () => {
  it("a row whose cell is not a number starts the count again", () => {
    const rows = [
      ["No.", "Principal", "Balance"],
      ["1", "$10", "$90"],
      ["2", "—", "$70"],
      ["3", "$10", "$60"],
    ];
    assert.deepEqual(issues(rows), []);
    const noBalance = [
      ["No.", "Principal", "Balance"],
      ["1", "$10", "$90"],
      ["2", "$10", "n/a"],
      ["3", "$10", "$50"],
    ];
    assert.deepEqual(issues(noBalance), []);
  });
  it("a total row is not a step of the chain", () => {
    const rows = [
      ["回", "元金", "残高"],
      ["1", "100", "900"],
      ["2", "100", "800"],
      ["合計", "200", "800"],
    ];
    assert.deepEqual(issues(rows), []);
  });
  it("amounts written in different units are not compared", () => {
    const rows = [
      ["No.", "Principal", "Balance"],
      ["1", "$10", "$90"],
      ["2", "¥10", "$70"],
    ];
    assert.deepEqual(issues(rows), []);
  });
  it("rows out of order: row numbers that do not rise, or a loan whose balance grows from first to last", () => {
    const shuffled = [
      ["No.", "Principal", "Balance"],
      ["2", "$10", "$80"],
      ["1", "$10", "$90"],
      ["3", "$10", "$75"],
    ];
    assert.deepEqual(issues(shuffled), []);
    const reversed = [
      ["Date", "Principal", "Balance"],
      ["Mar", "$10", "$70"],
      ["Feb", "$10", "$80"],
      ["Jan", "$10", "$90"],
    ];
    assert.deepEqual(issues(reversed), []);
  });
  it("a ledger row with both in and out blank (brought forward) starts the count again", () => {
    const rows = [
      ["Date", "Deposit", "Withdrawal", "Balance"],
      ["Sep 30", "100", "", "1,100"],
      ["Brought forward", "", "", "2,000"],
      ["Oct 1", "", "500", "1,500"],
    ];
    assert.deepEqual(issues(rows), []);
  });
  it("rows with a cell short are not read, and an empty table says nothing", () => {
    assert.deepEqual(
      issues([
        ["No.", "Principal", "Balance"],
        ["1", "$10", "$90"],
        ["2", "$10"],
      ]),
      [],
    );
    assert.deepEqual(issues([["No.", "Principal", "Balance"]]), []);
    assert.deepEqual(runningBalanceMismatches([], WORDS), []);
  });
});

const run = (adapter: LanguageAdapter, text: string): string[] =>
  runRules(buildDocument("t.md", text, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/proposal")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.line)}:${String(finding.values["balance"])}→${String(finding.values["computed"])}`);

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

describe("running-balance-mismatch: through the rule", () => {
  it("ja: 返済予定表の残高", () => {
    const table = [
      "| 回 | お支払日 | お支払額 | うち元金 | うち利息 | お支払後の残高 |",
      "| --- | --- | --- | --- | --- | --- |",
      "| 1 | 2026年11月27日 | 32,826円 | 27,426円 | 5,400円 | 1,772,574円 |",
      "| 2 | 2026年12月27日 | 32,826円 | 27,508円 | 5,318円 | 1,754,066円 |",
    ];
    assert.deepEqual(run(ja, ["# ご返済予定", "", ...table, ""].join("\n")), ["6:1,754,066円→1,745,066円"]);
    const fixed = table.map((line) => line.replace("1,754,066円", "1,745,066円"));
    assert.deepEqual(run(ja, ["# ご返済予定", "", ...fixed, ""].join("\n")), []);
  });
  it("en: an account statement", () => {
    const table = [
      "| Date | Deposit | Withdrawal | Balance |",
      "| --- | --- | --- | --- |",
      "| Oct 1 | $500.00 | | $1,500.00 |",
      "| Oct 2 | | $200.00 | $1,200.00 |",
    ];
    assert.deepEqual(run(en, ["# Statement", "", ...table, ""].join("\n")), ["6:$1,200.00→$1,300.00"]);
  });
});
