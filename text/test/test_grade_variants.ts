import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseItems, type ItemVocabulary } from "../packages/chaff/src/grade/item.ts";
import { parseResults } from "../packages/chaff/src/grade/results-read.ts";
import { compareRuns } from "../packages/chaff/src/grade/baseline.ts";
import { renderVariantsMarkdown } from "../packages/chaff/src/grade/render-variants.ts";
import { VARIANT_TEXT } from "../packages/chaff/src/grade/variants-text.ts";
import type { GradeResult } from "../packages/chaff/src/grade/result.ts";
import { compareVariants, grade, GradeInputError, type VariantInput } from "../packages/chaff/src/grade-api.ts";
import { variantGroupsOf } from "../packages/chaff/src/grade/variants-input.ts";
import { runCli } from "./cli-run.ts";
import { fact, finding, jsonl, resultsIn } from "./grade-run.ts";

// Variants side by side: items labelled by prompt or model, matched by id, and compared in one table.

const VOCABULARY: ItemVocabulary = { isLanguage: (language) => ["ja", "en"].includes(language), genres: ["blog/tech"] };

const problemsOf = (text: string, key = "variant", required = false): string[] => {
  const parsed = parseItems(text, VOCABULARY, { key, required });
  return "problems" in parsed ? parsed.problems.map((problem) => `${String(problem.line)}:${problem.kind}`) : [];
};

const result = (id: string, variant: string | undefined, overrides: Partial<GradeResult> = {}): GradeResult => ({
  id,
  ...(variant === undefined ? {} : { variant }),
  language: "en",
  genre: "blog/tech",
  size: { unit: "word", value: 500 },
  findings: [],
  rates: {},
  notRun: [],
  facts: null,
  citations: null,
  pass: true,
  failedBecause: [],
  stamp: { chaff: "chaffjs 0", rules: "sha256:r", settings: "sha256:s" },
  ...overrides,
});

const problemsThrown = (input: VariantInput): readonly string[] => {
  try {
    compareVariants(input);
  } catch (error) {
    if (error instanceof GradeInputError) return error.problems;
    throw error;
  }
  return [];
};

describe("variant labels in the input", () => {
  it("reads a variant label, and lets two variants share an id", () => {
    const parsed = parseItems(jsonl({ id: "q", output: "x", variant: "a" }, { id: "q", output: "y", variant: "b" }), VOCABULARY);
    assert.ok("items" in parsed);
    assert.deepEqual(
      parsed.items.map((item) => [item.id, item.variant]),
      [
        ["q", "a"],
        ["q", "b"],
      ],
    );
  });

  it("reads the label under another field when told to, and then needs it on every line", () => {
    const parsed = parseItems(jsonl({ id: "q", output: "x", model: "m1" }), VOCABULARY, { key: "model", required: true });
    assert.ok("items" in parsed && parsed.items[0]?.variant === "m1");
    assert.deepEqual(problemsOf(jsonl({ id: "q", output: "x" }), "model", true), ["1:no-variant"]);
  });

  it("refuses a label that is not a string, a line without one among labelled lines, and an id twice in one variant", () => {
    assert.deepEqual(problemsOf(jsonl({ id: "q", output: "x", variant: 3 })), ["1:not-string"]);
    assert.deepEqual(problemsOf(jsonl({ id: "q", output: "x", variant: "" })), ["1:not-string"]);
    assert.deepEqual(problemsOf(jsonl({ id: "q", output: "x", variant: "a" }, { id: "r", output: "y" })), ["2:no-variant"]);
    assert.deepEqual(problemsOf(jsonl({ id: "q", output: "x", variant: "a" }, { id: "q", output: "y", variant: "a" })), ["2:duplicate-id"]);
    assert.deepEqual(problemsOf(jsonl({ output: "x", variant: "a" })), ["1:no-id"]);
  });

  it("reads a file without labels as before", () => {
    assert.deepEqual(problemsOf(jsonl({ id: "q", output: "x" }, { id: "r", output: "y" })), []);
  });
});

describe("comparing variants", () => {
  it("compares only the ids every variant answered, and names the rest", () => {
    const compared = compareVariants([
      result("q1", "a"),
      result("q2", "a", { pass: false, failedBecause: ["facts.dropped 1 > 0"], facts: { dropped: [fact()], added: [], reformed: 0 } }),
      result("q3", "a"),
      result("q1", "b", { findings: [finding("warning", "closing-cliche")] }),
      result("q2", "b"),
      result("q4", "b"),
    ]);
    assert.deepEqual(compared.variants, ["a", "b"]);
    assert.deepEqual(compared.compared, ["q1", "q2"]);
    assert.deepEqual(compared.missing, [
      { id: "q3", missingFrom: ["b"] },
      { id: "q4", missingFrom: ["a"] },
    ]);
    assert.deepEqual(
      compared.columns.map((column) => [column.variant, column.outputs, column.passed, column.passRate, column.facts.dropped]),
      [
        ["a", 2, 1, 50, 1],
        ["b", 2, 2, 100, 0],
      ],
    );
    assert.deepEqual(compared.rules, [{ rule: "closing-cliche", unit: "word", rates: { a: 0, b: 1 } }]);
    assert.deepEqual(compared.disagreements, [{ id: "q2", passedIn: ["b"], failedIn: [{ variant: "a", failedBecause: ["facts.dropped 1 > 0"] }] }]);
  });

  it("does not compare an id read in another language, and gives no pass rate over nothing", () => {
    const compared = compareVariants({ a: [result("q", undefined)], b: [result("q", undefined, { language: "ja", size: { unit: "char", value: 9 } })] });
    assert.deepEqual([compared.compared, compared.readOtherwise], [[], ["q"]]);
    assert.deepEqual(
      compared.columns.map((column) => [column.outputs, column.passRate]),
      [
        [0, undefined],
        [0, undefined],
      ],
    );
  });

  it("adds up penalty points only when the results were scored", () => {
    const scored = { score: { penalty: 3, items: [] } };
    const compared = compareVariants({ a: [result("q", undefined, scored)], b: [result("q", undefined, scored)] });
    assert.deepEqual(
      compared.columns.map((column) => column.penalty),
      [3, 3],
    );
    assert.equal(compareVariants({ a: [result("q", undefined)] }).columns[0]?.penalty, undefined);
  });

  it("refuses a result without an id or a variant, an id twice in one variant, and no result at all", () => {
    assert.match(problemsThrown([result("", "a")]).join(), /results\[0\]: not a grade result with an id/u);
    assert.match(problemsThrown([result("q", undefined)]).join(), /results\[0\]: id "q" has no variant/u);
    assert.match(problemsThrown({ a: [result("q", undefined), result("q", undefined)] }).join(), /a\[1\]: id "q" is already in variant "a"/u);
    assert.deepEqual(problemsThrown([]), ["no results to compare"]);
    // What untyped JavaScript could pass: checked by the reader compareVariants() calls.
    assert.deepEqual(variantGroupsOf({ a: "not results" }), { problems: ["a: not a grade result with an id"] });
    assert.deepEqual(variantGroupsOf([{ variant: "a" }]), { problems: ["results[0]: not a grade result with an id"] });
    assert.deepEqual(variantGroupsOf("results"), { problems: ["results must be an array of grade results, or { variant: results[] }"] });
  });

  it("writes a Markdown table whose cells cannot break it", () => {
    const compared = compareVariants({ "a|b": [result("q", undefined)], c: [result("q", undefined)] });
    const markdown = renderVariantsMarkdown(compared, VARIANT_TEXT.en);
    assert.match(markdown, /^\| {2}\| a\\\|b \| c \|$/mu);
    assert.match(markdown, /^\| Passed \| 1\/1 \(100%\) \| 1\/1 \(100%\) \|$/mu);
  });
});

describe("grade() with a variant", () => {
  it("keeps the label on the result, ready for compareVariants(), and refuses an empty one", async () => {
    const graded = await grade("# Notes\n\nThe deploy stopped.\n", { id: "q", variant: "small" });
    assert.equal(graded.variant, "small");
    assert.deepEqual(compareVariants([graded]).compared, ["q"]);
    await assert.rejects(grade("# Notes\n", { variant: "" }), GradeInputError);
  });
});

describe("variants and --baseline", () => {
  it("reads a variant back from the results, and pairs each output with the same variant's earlier one", () => {
    const lines = [result("q", "a"), result("q", "b")].map((entry) => JSON.stringify(entry)).join("\n");
    const parsed = parseResults(lines);
    assert.ok("results" in parsed);
    assert.deepEqual(parseResults(JSON.stringify({ ...result("q", "a"), variant: 3 })), { badLines: [1] });
    const later = [result("q", "a"), result("q", "b", { pass: false })];
    const comparison = compareRuns(parsed.results, later, new Set());
    assert.deepEqual([comparison.paired, comparison.newlyFailed], [2, ["q (b)"]]);
  });
});

const EN_A = "# Notes\n\nThe deploy stopped at the database step, and the release was rolled back.\n";
const EN_B = "# Notes\n\nThe deploy stopped at the database step.\n\nIn conclusion, robust migrations matter. I hope this helps!\n";
const ITEMS = jsonl(
  { id: "notes", output: EN_A, model: "small" },
  { id: "only-small", output: EN_A, model: "small" },
  { id: "notes", output: EN_B, model: "large" },
);

describe("chaff grade with variants on the command line", () => {
  it("in English: prints the variants side by side after the summary, with the ids not compared", async () => {
    const run = await runCli({ "items.jsonl": ITEMS }, ["grade", "items.jsonl", "--variant-key", "model", "--out", "out.jsonl"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /2 variants side by side: 1 output with an id every variant has/u);
    assert.match(run.out, /^ {2}Passed {13}1\/1 \(100%\) {2}1\/1 \(100%\)$/mu);
    assert.match(run.out, /^ {2}closing-cliche {2}0\.0 {4}[0-9.]+$/mu);
    assert.match(run.out, /only-small: missing from large/u);
    assert.deepEqual(
      resultsIn(run.dir).map((entry) => entry.variant),
      ["small", "small", "large"],
    );
  });

  it("in Japanese, as Markdown and as JSON", async () => {
    const ja = jsonl(
      { id: "見積", output: "# お見積り\n\n設計は 4 万円です。\n", variant: "短い" },
      { id: "見積", output: "# お見積り\n\n設計は 4 万円で、実装は 12 万円です。\n", variant: "長い" },
    );
    const markdown = await runCli({ "items.jsonl": ja }, ["grade", "items.jsonl", "--format", "markdown"], "ja_JP.UTF-8");
    assert.equal(markdown.code, 0, markdown.err);
    assert.match(markdown.out, /^## chaff grade: items\.jsonl$/mu);
    assert.match(markdown.out, /^### 2 つの variant を並べた: どの variant にもある id の出力 1 件$/mu);
    assert.match(markdown.out, /^\| 通った \| 1\/1（100%） \| 1\/1（100%） \|$/mu);
    const json = await runCli({ "items.jsonl": ITEMS }, ["grade", "items.jsonl", "--variant-key", "model", "--format", "json"], "en_US.UTF-8");
    const summary: unknown = JSON.parse(json.out);
    assert.ok(typeof summary === "object" && summary !== null && "variants" in summary);
    assert.match(json.out, /"compared": \[\n\s+"notes"\n\s+\]/u);
  });

  it("ends with 2 for a variant field an item already uses, an unknown format, or a line without a variant", async () => {
    const reserved = await runCli({ "items.jsonl": ITEMS }, ["grade", "items.jsonl", "--variant-key", "output"], "en_US.UTF-8");
    assert.equal(reserved.code, 2);
    const format = await runCli({ "items.jsonl": ITEMS }, ["grade", "items.jsonl", "--format", "html"], "en_US.UTF-8");
    assert.equal(format.code, 2);
    const unlabelled = await runCli({ "items.jsonl": ITEMS }, ["grade", "items.jsonl", "--variant-key", "prompt"], "en_US.UTF-8");
    assert.equal(unlabelled.code, 2);
    assert.match(unlabelled.err, /line 1: no prompt \(the variant's name\)/u);
  });
});
