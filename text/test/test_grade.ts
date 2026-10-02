import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseItems, type ItemVocabulary } from "../packages/chaff/src/grade/item.ts";
import { rateOf, ratesOf } from "../packages/chaff/src/grade/rates.ts";
import { defaultVerdict, type Graded } from "../packages/chaff/src/grade/verdict.ts";
import { summaryOf, type GradeSummary } from "../packages/chaff/src/grade/summary.ts";
import { canonicalJson, digestOf, settingsOf } from "../packages/chaff/src/grade/stamp.ts";
import { sourcePathOf } from "../packages/chaff/src/grade/grade-item.ts";
import type { GradeFact, GradeFinding, GradeResult } from "../packages/chaff/src/grade/result.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { runCli } from "./cli-run.ts";

// chaff grade: the input JSONL, the default pass or fail, the rates and summary, the stamp, and the command line in both languages.

const VOCABULARY: ItemVocabulary = { isLanguage: (language) => ["ja", "en"].includes(language), genres: ["blog/tech", "business/report"] };

const jsonl = (...rows: unknown[]): string => rows.map((row) => (typeof row === "string" ? row : JSON.stringify(row))).join("\n");

const problemsOf = (text: string): string[] => {
  const parsed = parseItems(text, VOCABULARY);
  return "problems" in parsed ? parsed.problems.map((problem) => `${String(problem.line)}:${problem.kind}`) : [];
};

describe("the input: one output per line", () => {
  it("reads every field, skips blank lines, and gives a lone source to a citation that names none", () => {
    const parsed = parseItems(
      jsonl({ id: "a", output: "One." }, "", {
        id: "b",
        output: "Two.",
        reference: "Ref.",
        language: "en",
        genre: "blog/tech",
        sources: { policy: "2.1 text" },
        citations: [{ address: "2.1", quote: "text" }],
      }),
      VOCABULARY,
    );
    assert.ok("items" in parsed);
    assert.deepEqual(
      parsed.items.map((item) => [item.id, item.reference, item.language, item.genre, item.citations]),
      [
        ["a", undefined, undefined, undefined, undefined],
        ["b", "Ref.", "en", "blog/tech", [{ source: "policy", address: "2.1", quote: "text" }]],
      ],
    );
  });

  it("names the line and the problem of each line it cannot grade", () => {
    const cases: readonly (readonly [string, string])[] = [
      ["{not json", "1:not-json"],
      ["[1, 2]", "1:not-object"],
      [jsonl({ output: "x" }), "1:no-id"],
      [jsonl({ id: "", output: "x" }), "1:no-id"],
      [jsonl({ id: "a" }), "1:no-output"],
      [jsonl({ id: "a", output: 3 }), "1:no-output"],
      [jsonl({ id: "a", output: "x", reference: 3 }), "1:not-string"],
      [jsonl({ id: "a", output: "x", sources: ["text"] }), "1:not-text-map"],
      [jsonl({ id: "a", output: "x", sources: { s: 1 } }), "1:not-text-map"],
      [jsonl({ id: "a", output: "x", sources: { s: "t" }, citations: { address: "1" } }), "1:not-citations"],
      [jsonl({ id: "a", output: "x", sources: { s: "t" }, citations: [{ address: "1" }] }), "1:not-citations"],
      [jsonl({ id: "a", output: "x", citations: [{ address: "1", quote: "t" }] }), "1:citations-without-sources"],
      [jsonl({ id: "a", output: "x", sources: { s: "t" }, citations: [{ source: "u", address: "1", quote: "t" }] }), "1:unknown-source"],
      [jsonl({ id: "a", output: "x", sources: { s: "t", u: "v" }, citations: [{ address: "1", quote: "t" }] }), "1:which-source"],
      [jsonl({ id: "a", output: "x", language: "xx" }), "1:unknown-language"],
      [jsonl({ id: "a", output: "x", genre: "poetry" }), "1:unknown-genre"],
      [jsonl({ id: "a", output: "x" }, { id: "a", output: "y" }), "2:duplicate-id"],
      ["\n\n", "0:empty"],
    ];
    cases.forEach(([text, expected]) => assert.deepEqual(problemsOf(text), [expected], text));
  });

  it("reports every bad line in line order, not only the first", () => {
    assert.deepEqual(problemsOf(jsonl({ id: "a", output: "x" }, "{", { id: "a", output: "y" }, { id: "c" })), ["2:not-json", "3:duplicate-id", "4:no-output"]);
  });
});

describe("rates per 1,000 units", () => {
  it("counts each rule's findings against the output's length", () => {
    assert.deepEqual(ratesOf(["b-rule", "a-rule", "b-rule"], { unit: "word", value: 400 }), { "a-rule": 2.5, "b-rule": 5 });
  });

  it("gives no rate over an output with no length, rather than zero", () => {
    assert.equal(rateOf(1, 0), undefined);
    assert.deepEqual(ratesOf(["a-rule"], { unit: "char", value: 0 }), {});
  });
});

const finding = (level: GradeFinding["level"], rule = "some-rule"): GradeFinding => ({ rule, level, line: 1, column: 1, message: "" });
const fact = (allowed = false): GradeFact => ({ kind: "number", key: "6", text: "6", line: 1, allowed });
const graded = (overrides: Partial<Graded>): Graded => ({ findings: [], facts: null, citations: null, ...overrides });

describe("the default pass or fail", () => {
  it("passes an output with only warnings and info: those are rates to compare, not a verdict", () => {
    assert.deepEqual(defaultVerdict(graded({ findings: [finding("warning"), finding("info")] })), { pass: true, failedBecause: [] });
  });

  it("passes when nothing was given to check against", () => {
    assert.equal(defaultVerdict(graded({})).pass, true);
  });

  it("fails on each condition, and names how far it went", () => {
    const failing: readonly (readonly [Partial<Graded>, string])[] = [
      [{ findings: [finding("error"), finding("error")] }, "findings.error 2 > 0"],
      [{ facts: { dropped: [fact()], added: [], reformed: 0 } }, "facts.dropped 1 > 0"],
      [{ facts: { dropped: [], added: [fact(), fact()], reformed: 0 } }, "facts.added 2 > 0"],
      [{ citations: { checked: 2, failed: [{ source: "s", address: "1", quote: "q", status: "quote-not-found" }] } }, "citations.failed 1 > 0"],
    ];
    failing.forEach(([input, reason]) => assert.deepEqual(defaultVerdict(graded(input)), { pass: false, failedBecause: [reason] }));
  });

  it("does not count a fact whose kind was allowed to change", () => {
    assert.equal(defaultVerdict(graded({ facts: { dropped: [fact(true)], added: [fact(true)], reformed: 0 } })).pass, true);
  });
});

const result = (id: string, unit: "char" | "word", size: number, rules: readonly string[], pass = true): GradeResult => ({
  id,
  language: unit === "char" ? "ja" : "en",
  genre: "blog/tech",
  size: { unit, value: size },
  findings: rules.map((rule) => finding("warning", rule)),
  rates: {},
  notRun: [{ rule: "compare", reason: "no reference" }],
  facts: { dropped: [fact(), fact(true)], added: [], reformed: 0 },
  citations: null,
  pass,
  failedBecause: pass ? [] : ["facts.dropped 1 > 0"],
  stamp: { chaff: "chaffjs 0", rules: "sha256:r", settings: "sha256:s" },
});

describe("the summary", () => {
  const summary = summaryOf([result("a", "word", 500, ["x", "x"]), result("b", "word", 500, ["x"], false), result("c", "char", 2000, ["x", "y"])]);

  it("sums rates per unit: characters and words are never added together", () => {
    assert.deepEqual(summary.size, { word: 1000, char: 2000 });
    assert.deepEqual(summary.rules["x"], { findings: 4, outputs: 3, rate: { word: 3, char: 0.5 } });
    assert.deepEqual(summary.rules["y"], { findings: 1, outputs: 1, rate: { char: 0.5 } });
  });

  it("lists the failed outputs, the facts that count, and each check not run with how many outputs", () => {
    assert.deepEqual([summary.total, summary.passed, summary.failed], [3, 2, [{ id: "b", failedBecause: ["facts.dropped 1 > 0"] }]]);
    assert.deepEqual(summary.facts, { dropped: { number: 3 }, added: {} });
    assert.deepEqual(summary.notRun, [{ rule: "compare", reason: "no reference", outputs: 3 }]);
  });
});

describe("the stamp", () => {
  it("does not change with the order keys were written in", () => {
    assert.equal(canonicalJson({ b: 1, a: { d: [2, 1], c: null } }), canonicalJson({ a: { c: null, d: [2, 1] }, b: 1 }));
    assert.equal(digestOf({ b: 1, a: 2 }), digestOf({ a: 2, b: 1 }));
  });

  it("changes with a setting that changes the findings, and not with one that does not", () => {
    const base = { config: EMPTY, experimental: false, genre: undefined };
    const settings = digestOf(settingsOf(base));
    assert.notEqual(digestOf(settingsOf({ ...base, experimental: true })), settings);
    assert.notEqual(digestOf(settingsOf({ ...base, config: { ...EMPTY, rules: { "ai-tell": "strict" } } })), settings);
    assert.notEqual(digestOf(settingsOf({ ...base, genre: "business/report" })), settings);
    assert.notEqual(digestOf(["first", "second"]), digestOf(["second", "first"]));
    assert.equal(digestOf(settingsOf({ ...base, config: { ...EMPTY, aiModel: "another-model", baseDir: "/elsewhere" } })), settings);
  });
});

describe("a source's name decides how it is read", () => {
  it("as plain text when named .txt, else as Markdown", () => {
    assert.deepEqual(["contract.txt", "policy.md", "policy", "2.1"].map(sourcePathOf), ["contract.txt", "policy.md", "policy.md", "2.1.md"]);
  });
});

const EN_SOURCE = "# Support report\n\nThe team answered 4,812 tickets.\nThe median first reply fell from 6 hours to 2.5 hours.\n";
const EN_POLICY =
  "# Refund policy\n\n## 2. Refunds\n\n2.1 A customer may ask for a refund within 30 days of delivery.\n\n2.2 Shipping fees are not refunded.\n";

const EN_ITEMS = jsonl(
  { id: "kept", output: "# Support report\n\nThe team answered 4,812 tickets. Replies fell from 6 hours to 2.5 hours.\n", reference: EN_SOURCE },
  { id: "dropped", output: "# Support report\n\nThe team answered 4,812 tickets, and replies got faster.\n", reference: EN_SOURCE },
  {
    id: "quoted",
    output: "Refunds are open for 30 days (2.1).",
    sources: { policy: EN_POLICY },
    citations: [{ address: "2.1", quote: "within 30 days of delivery" }],
  },
  {
    id: "misquoted",
    output: "Shipping is refunded (2.2).",
    sources: { policy: EN_POLICY },
    citations: [{ address: "2.2", quote: "Shipping fees are refunded." }],
  },
  { id: "styled", output: "# Notes\n\nThe build broke on Monday. We fixed it the same day.\n\nIn conclusion, I hope this helps!\n" },
);

const JA_SOURCE = "# 第3四半期の報告\n\nサポートは今期 4,812 件に答えた。\n返信の中央値は 6 時間から 2.5 時間に縮んだ。\n";

const JA_ITEMS = jsonl(
  { id: "守った", output: "# 第3四半期の報告\n\n今期は 4,812 件に答え、返信の中央値は 6 時間から 2.5 時間に縮んだ。\n", reference: JA_SOURCE },
  { id: "落とした", output: "# 第3四半期の報告\n\n今期は 4,812 件に答え、返信は速くなった。\n", reference: JA_SOURCE },
  { id: "合わない合計", output: "# お見積り\n\n| 項目 | 金額 |\n| --- | --- |\n| 設計 | 40,000円 |\n| 実装 | 120,000円 |\n| 合計 | 150,000円 |\n" },
);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** The fields these tests read. The shape itself is the type's; the command line is what is under test. */
const isGradeResult = (value: unknown): value is GradeResult =>
  isRecord(value) && typeof value["id"] === "string" && Array.isArray(value["findings"]) && isRecord(value["stamp"]) && isRecord(value["size"]);

const isSummary = (value: unknown): value is GradeSummary => isRecord(value) && typeof value["total"] === "number" && Array.isArray(value["failed"]);

const resultsIn = (dir: string, name = "out.jsonl"): GradeResult[] =>
  readFileSync(join(dir, name), "utf8")
    .trim()
    .split("\n")
    .map((line): unknown => JSON.parse(line))
    .filter(isGradeResult);

describe("chaff grade on the command line", () => {
  it("in English: passes what kept its facts and quotations, fails what did not, and writes one result per output", async () => {
    const run = await runCli({ "items.jsonl": EN_ITEMS }, ["grade", "items.jsonl", "--out", "out.jsonl", "--compact"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.equal(
      run.out,
      [
        "kept\tpass",
        "dropped\tfail\tfacts.dropped 2 > 0",
        "quoted\tpass",
        "misquoted\tfail\tcitations.failed 1 > 0",
        "styled\tpass",
        "items.jsonl: 5 outputs, 3 passed, 2 failed",
      ].join("\n"),
    );
    const results = resultsIn(run.dir);
    assert.deepEqual(
      results.map((entry) => entry.id),
      ["kept", "dropped", "quoted", "misquoted", "styled"],
    );
    const styled = results[4];
    assert.ok(styled !== undefined);
    assert.deepEqual(
      styled.findings.map((entry) => [entry.rule, entry.level]),
      [["closing-cliche", "warning"]],
    );
    assert.equal(styled.size.unit, "word");
    assert.ok((styled.rates["closing-cliche"] ?? 0) > 0);
    assert.deepEqual(
      styled.notRun.filter((entry) => entry.rule === "compare" || entry.rule === "cite").map((entry) => entry.rule),
      ["compare", "cite"],
    );
    assert.deepEqual(
      results[1]?.facts?.dropped.map((entry) => entry.text),
      ["6", "2.5"],
    );
    assert.equal(results[3]?.citations?.failed[0]?.status, "quote-not-found");
    assert.match(styled.stamp.rules, /^sha256:[0-9a-f]{64}$/u);
  });

  it("in Japanese: an error finding fails an output, and the summary speaks Japanese", async () => {
    const run = await runCli({ "items.jsonl": JA_ITEMS }, ["grade", "items.jsonl", "--experimental"], "ja_JP.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.out, /items\.jsonl: 3 件の出力、1 件が通り、2 件が落ちた/u);
    assert.match(run.out, /✗ 落とした: facts\.dropped 2 > 0/u);
    assert.match(run.out, /✗ 合わない合計: findings\.error 1 > 0/u);
    assert.match(run.out, /ルールごとの率（1,000 字あたり/u);
    assert.match(run.out, /total-mismatch/u);
  });

  it("ends with 0 when every output passes, and gives the summary as JSON with --json", async () => {
    const items = jsonl({ id: "one", output: "# 報告\n\n今期は 4,812 件に答えた。\n", reference: "# 報告\n\n今期は 4,812 件に答えた。\n" });
    const run = await runCli({ "items.jsonl": items }, ["grade", "items.jsonl", "--json"], "ja_JP.UTF-8");
    assert.equal(run.code, 0);
    const summary: unknown = JSON.parse(run.out);
    assert.ok(isSummary(summary));
    assert.deepEqual([summary.total, summary.passed, summary.failed], [1, 1, []]);
    assert.match(summary.stamp?.settings ?? "", /^sha256:/u);
  });

  it("stamps the same rules and settings the same way on every run, and other settings another way", async () => {
    const items = jsonl({ id: "one", output: "A short note." });
    const first = await runCli({ "items.jsonl": items }, ["grade", "items.jsonl", "--out", "out.jsonl"], "en_US.UTF-8");
    const second = await runCli({ "items.jsonl": items }, ["grade", "items.jsonl", "--out", "out.jsonl"], "en_US.UTF-8");
    const experimental = await runCli({ "items.jsonl": items }, ["grade", "items.jsonl", "--out", "out.jsonl", "--experimental"], "en_US.UTF-8");
    const [a, b, c] = [first, second, experimental].map((run) => resultsIn(run.dir)[0]?.stamp);
    assert.deepEqual(a, b);
    assert.equal(a?.rules, c?.rules);
    assert.notEqual(a?.settings, c?.settings);
  });

  it("reads an output in the language and genre its item names, and honours a stet in it as lint does", async () => {
    const items = jsonl(
      { id: "named", output: "# 報告\n\n今期は 4,812 件に答えた。\n", language: "en", genre: "business/report" },
      {
        id: "silenced",
        output: "# Notes\n\nThe build broke on Monday.\n\n<!-- stet: closing-cliche — the house sign-off -->\nIn conclusion, I hope this helps!\n",
      },
    );
    const run = await runCli({ "items.jsonl": items }, ["grade", "items.jsonl", "--out", "out.jsonl"], "en_US.UTF-8");
    const [named, silenced] = resultsIn(run.dir);
    assert.deepEqual([named?.language, named?.genre], ["en", "business/report"]);
    assert.deepEqual(
      silenced?.findings.map((entry) => entry.rule),
      [],
    );
  });

  it("ends with 2, not 1, when the input cannot be graded, and says which line", async () => {
    const bad = await runCli({ "items.jsonl": jsonl({ id: "a", output: "x" }, { id: "a", output: "y" }) }, ["grade", "items.jsonl"], "en_US.UTF-8");
    assert.equal(bad.code, 2);
    assert.match(bad.err, /items\.jsonl: line 2: id "a" is already on line 1/u);
    assert.equal(bad.out, "");
    const missing = await runCli({}, ["grade", "nowhere.jsonl"], "en_US.UTF-8");
    assert.equal(missing.code, 2);
    const usage = await runCli({}, ["grade"], "ja_JP.UTF-8");
    assert.equal(usage.code, 2);
    assert.match(usage.err, /使い方: chaff grade/u);
    const setting = await runCli({ "items.jsonl": jsonl({ id: "a", output: "x" }), "chaff.yaml": "genre: poetry\n" }, ["grade", "items.jsonl"], "en_US.UTF-8");
    assert.equal(setting.code, 2);
  });
});
