import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compareRuns, stampCheck } from "../packages/chaff/src/grade/baseline.ts";
import { parseResults } from "../packages/chaff/src/grade/results-read.ts";
import { renderComparison } from "../packages/chaff/src/grade/render-baseline.ts";
import { BASELINE_TEXT } from "../packages/chaff/src/grade/baseline-text.ts";
import type { GradeFact, GradeResult, Stamp } from "../packages/chaff/src/grade/result.ts";
import { runCli } from "./cli-run.ts";
import { finding, isSummary, jsonl, resultsIn } from "./grade-run.ts";

// chaff grade --baseline: earlier results read back, stamps compared, outputs paired by id, and what counts as a regression.

const STAMP: Stamp = { chaff: "chaffjs 0", rules: "sha256:r", settings: "sha256:s" };

type ResultParts = { readonly rules?: readonly string[]; readonly pass?: boolean; readonly dropped?: readonly GradeFact[]; readonly penalty?: number };

const result = (id: string, parts: ResultParts = {}, overrides: Partial<GradeResult> = {}): GradeResult => ({
  id,
  language: "en",
  genre: "blog/tech",
  size: { unit: "word", value: 500 },
  findings: (parts.rules ?? []).map((rule) => finding("warning", rule)),
  rates: {},
  notRun: [],
  facts: { dropped: parts.dropped ?? [], added: [], reformed: 0 },
  citations: null,
  ...(parts.penalty === undefined ? {} : { score: { penalty: parts.penalty, items: [] } }),
  pass: parts.pass ?? true,
  failedBecause: [],
  stamp: STAMP,
  ...overrides,
});

const numberFact = (key: string, allowed = false): GradeFact => ({ kind: "number", key, text: key, line: 1, allowed });

describe("reading an earlier run's results", () => {
  it("reads the lines chaff grade wrote", () => {
    const parsed = parseResults(`${JSON.stringify(result("a"))}\n\n${JSON.stringify(result("b"))}\n`);
    assert.ok("results" in parsed);
    assert.deepEqual(
      parsed.results.map((entry) => entry.id),
      ["a", "b"],
    );
  });

  it("names every line that is not a result, and refuses an empty file", () => {
    const items = jsonl({ id: "a", output: "x" });
    assert.deepEqual(parseResults(`${JSON.stringify(result("a"))}\n${items}\n{`), { badLines: [2, 3] });
    assert.deepEqual(parseResults(JSON.stringify({ ...result("a"), stamp: { chaff: "x" } })), { badLines: [1] });
    assert.deepEqual(parseResults("\n"), { badLines: [0] });
  });

  it("refuses a line that only looks like a result, and an id that a line before already has", () => {
    const line = (value: unknown): string => JSON.stringify(value);
    const good = result("a");
    const failed = { source: "s", address: "1", quote: "q", status: "quote-not-found" };
    const shapes: readonly unknown[] = [
      { ...good, rates: undefined },
      { ...good, notRun: undefined },
      { ...good, findings: [{ rule: "x", level: "warning", line: 1 }] },
      { ...good, facts: { dropped: [{ kind: "number", key: "6", allowed: false }], added: [], reformed: 0 } },
      { ...good, citations: { checked: 1, failed: [{ ...failed, source: undefined }] } },
      { ...good, score: { penalty: 1 } },
    ];
    shapes.forEach((shape) => assert.deepEqual(parseResults(line(shape)), { badLines: [1] }, line(shape)));
    assert.ok("results" in parseResults(line({ ...good, citations: { checked: 1, failed: [failed] }, score: { penalty: 1, items: [] } })));
    assert.deepEqual(parseResults([line(good), line(result("b")), line(result("a", { pass: false }))].join("\n")), { badLines: [3] });
  });
});

describe("comparing stamps", () => {
  it("compares runs with the same rules and settings, whatever the chaff version", () => {
    assert.deepEqual(stampCheck([result("a", {}, { stamp: { ...STAMP, chaff: "chaffjs 9" } })], STAMP), { comparable: true });
  });

  it("refuses other rules, other settings, and a baseline that mixes stamps", () => {
    assert.deepEqual(stampCheck([result("a")], { ...STAMP, rules: "sha256:other" }), { comparable: false, differ: ["rules"] });
    assert.deepEqual(stampCheck([result("a")], { ...STAMP, rules: "sha256:x", settings: "sha256:y" }), { comparable: false, differ: ["rules", "settings"] });
    assert.deepEqual(stampCheck([result("a"), result("b", {}, { stamp: { ...STAMP, settings: "sha256:other" } })], STAMP), {
      comparable: false,
      differ: ["mixed"],
    });
    assert.deepEqual(stampCheck([result("a"), result("b", {}, { stamp: { ...STAMP, chaff: "chaffjs 9" } })], STAMP), {
      comparable: false,
      differ: ["mixed"],
    });
  });
});

describe("pairing and regressions", () => {
  it("pairs by id, and sets aside ids on one side only and pairs read in another language or genre", () => {
    const comparison = compareRuns(
      [result("a"), result("b"), result("c")],
      [result("a"), result("c", {}, { genre: "business/report" }), result("d")],
      new Set(),
    );
    assert.deepEqual([comparison.paired, comparison.onlyBefore, comparison.onlyAfter, comparison.readOtherwise], [1, ["b"], ["d"], ["c"]]);
    assert.deepEqual(compareRuns([result("a")], [result("a", {}, { language: "ja" })], new Set()).readOtherwise, ["a"]);
  });

  it("is a regression when an output that passed now fails, and not the other way", () => {
    const worse = compareRuns([result("a")], [result("a", { pass: false })], new Set());
    assert.deepEqual([worse.newlyFailed, worse.regressions], [["a"], ["a: passed, now fails"]]);
    const better = compareRuns([result("a", { pass: false })], [result("a")], new Set());
    assert.deepEqual([better.newlyPassed, better.regressions], [["a"], []]);
  });

  it("moves each rule's rate and names the outputs, but only a rubric rule's increase is a regression", () => {
    const before = [result("a", { rules: ["closing-cliche"] }), result("b")];
    const after = [result("a"), result("b", { rules: ["closing-cliche", "closing-cliche", "ai-tell"] })];
    const comparison = compareRuns(before, after, new Set(["closing-cliche"]));
    assert.deepEqual(comparison.rules, [
      { rule: "ai-tell", unit: "word", before: 0, after: 1, increasedIn: ["b"], decreasedIn: [], inRubric: false },
      { rule: "closing-cliche", unit: "word", before: 1, after: 2, increasedIn: ["b"], decreasedIn: ["a"], inRubric: true },
    ]);
    assert.deepEqual(comparison.regressions, ["rules.closing-cliche: more findings in b"]);
    assert.deepEqual(compareRuns(before, after, new Set()).regressions, []);
  });

  it("is a regression when the penalty points add up to more", () => {
    const comparison = compareRuns(
      [result("a", { penalty: 2 }), result("b", { penalty: 3 })],
      [result("a", { penalty: 4 }), result("b", { penalty: 2 })],
      new Set(),
    );
    assert.deepEqual(comparison.penalty, { before: 5, after: 6 });
    assert.deepEqual(comparison.regressions, ["score.penalty 5 → 6"]);
    assert.deepEqual(compareRuns([result("a", { penalty: 2 })], [result("a", { penalty: 2 })], new Set()).regressions, []);
  });

  it("lists only the facts newly dropped: one dropped before too is not new, a second of it is, and an allowed one is never", () => {
    const comparison = compareRuns(
      [result("a", { dropped: [numberFact("6")] })],
      [result("a", { dropped: [numberFact("6"), numberFact("6"), numberFact("7", true)] })],
      new Set(),
    );
    assert.deepEqual(
      comparison.items.map((change) => [change.id, change.dropped.map((fact) => fact.key)]),
      [["a", ["6"]]],
    );
  });

  it("writes one output's new facts and quotations on one line, in the language of the screen", () => {
    const failed = { source: "policy", address: "2.2", quote: "q", status: "quote-not-found" as const };
    const comparison = compareRuns([result("a")], [result("a", { dropped: [numberFact("6")] }, { citations: { checked: 1, failed: [failed] } })], new Set());
    assert.match(renderComparison("a.results.jsonl", comparison, BASELINE_TEXT.ja), /^ {2}a: 落ちた number 6、足された なし、外れた引用 policy 2\.2$/mu);
    assert.match(renderComparison("a.results.jsonl", comparison, BASELINE_TEXT.en), /^ {2}a: dropped number 6; added none; failed quotations policy 2\.2$/mu);
  });

  it("lists only the quotations newly failed", () => {
    const failed = (address: string): NonNullable<GradeResult["citations"]>["failed"][number] => ({
      source: "s",
      address,
      quote: "q",
      status: "quote-not-found",
    });
    const comparison = compareRuns(
      [result("a", {}, { citations: { checked: 2, failed: [failed("1")] } })],
      [result("a", {}, { citations: { checked: 2, failed: [failed("1"), failed("2")] } })],
      new Set(),
    );
    assert.deepEqual(
      comparison.items.map((change) => change.citations.map((citation) => citation.address)),
      [["2"]],
    );
  });
});

const EN_SOURCE = "# Support report\n\nThe team answered 4,812 tickets.\nThe median first reply fell from 6 hours to 2.5 hours.\n";

const EN_A = jsonl(
  { id: "summary", output: "# Support report\n\nThe team answered 4,812 tickets. Replies fell from 6 hours to 2.5 hours.\n", reference: EN_SOURCE },
  { id: "notes", output: "# Notes\n\nThe build broke on Monday. We fixed it the same day.\n" },
);

const EN_B = jsonl(
  { id: "summary", output: "# Support report\n\nThe team answered 4,812 tickets, and replies got faster.\n", reference: EN_SOURCE },
  { id: "notes", output: "# Notes\n\nThe build broke on Monday. We fixed it the same day.\n\nIn conclusion, I hope this helps!\n" },
);

/** Grades `earlier` into a.results.jsonl, then `later` against it, in one directory. */
const abRun = async (earlier: string, later: string, extra: readonly string[], lang: string, yaml?: string) => {
  const files = { "a.jsonl": earlier, "b.jsonl": later, ...(yaml === undefined ? {} : { "chaff.yaml": yaml }) };
  const first = await runCli(files, ["grade", "a.jsonl", "--out", "a.results.jsonl"], lang);
  assert.equal(first.code === 0 || first.code === 1, true, first.err);
  return runCli(
    {
      ...files,
      "a.results.jsonl": resultsIn(first.dir, "a.results.jsonl")
        .map((entry) => JSON.stringify(entry))
        .join("\n"),
    },
    ["grade", "b.jsonl", "--baseline", "a.results.jsonl", ...extra],
    lang,
  );
};

describe("chaff grade --baseline on the command line", () => {
  it("in English: ends with 1 on a regression, naming the output that newly fails and where a rule grew", async () => {
    const run = await abRun(EN_A, EN_B, [], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.out, /Compared with a\.results\.jsonl: 2 paired outputs/u);
    assert.match(run.out, /closing-cliche +0\.0 → 38\.5 {2}\(\+38\.5\) {2}more in notes/u);
    assert.match(run.out, /summary: dropped number 6, number 2\.5; added none/u);
    assert.match(run.out, /✗ summary: passed, now fails/u);
  });

  it("ends with 0 when nothing regressed: outputs only passed again or got better", async () => {
    const run = await abRun(EN_B, EN_A, ["--compact"], "en_US.UTF-8");
    assert.equal(run.code, 0);
    assert.match(run.out, /No regression$/u);
  });

  it("in Japanese: a rubric rule that grew is a regression", async () => {
    const yaml = "grade:\n  rules:\n    total-mismatch: { weight: 2 }\n";
    const fine = jsonl({ id: "見積", output: "# お見積り\n\n| 項目 | 金額 |\n| --- | --- |\n| 設計 | 40,000円 |\n| 合計 | 40,000円 |\n" });
    const wrong = jsonl({
      id: "見積",
      output: "# お見積り\n\n| 項目 | 金額 |\n| --- | --- |\n| 設計 | 40,000円 |\n| 実装 | 120,000円 |\n| 合計 | 150,000円 |\n",
    });
    const run = await abRun(fine, wrong, ["--experimental", "--json"], "ja_JP.UTF-8", `experimental: true\n${yaml}`);
    assert.equal(run.code, 1);
    const summary: unknown = JSON.parse(run.out);
    assert.ok(isSummary(summary) && "baseline" in summary);
    assert.match(run.out, /"regressions": \[\n\s+"rules\.total-mismatch: more findings in 見積"/u);
    assert.match(run.out, /score\.penalty 0 → 2/u);
  });

  it("ends with 2 rather than compare runs with other settings, and compares with --allow-stamp-mismatch, saying so first", async () => {
    const refused = await abRun(EN_A, EN_B, ["--experimental"], "en_US.UTF-8");
    assert.equal(refused.code, 2);
    assert.match(refused.err, /Not compared with a\.results\.jsonl: the settings differ/u);
    assert.equal(refused.out, "");
    const allowed = await abRun(EN_A, EN_B, ["--experimental", "--allow-stamp-mismatch"], "en_US.UTF-8");
    assert.equal(allowed.code, 1);
    assert.match(allowed.err, /^Note: the settings differ from a\.results\.jsonl/u);
  });

  it("ends with 2 on a baseline that is not results, before grading anything", async () => {
    const run = await runCli({ "b.jsonl": EN_B, "a.jsonl": EN_A }, ["grade", "b.jsonl", "--baseline", "a.jsonl"], "ja_JP.UTF-8");
    assert.equal(run.code, 2);
    assert.match(run.err, /a\.jsonl: chaff grade --out の 1 回分の結果として読めない行があります（1, 2 行目/u);
    const missing = await runCli({ "b.jsonl": EN_B }, ["grade", "b.jsonl", "--baseline", "none.jsonl"], "en_US.UTF-8");
    assert.equal(missing.code, 2);
  });
});
