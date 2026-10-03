import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseItems, type ItemVocabulary } from "../packages/chaff/src/grade/item.ts";
import { parseRubric } from "../packages/chaff/src/grade/rubric.ts";
import { parseResults } from "../packages/chaff/src/grade/results-read.ts";
import { summaryOf } from "../packages/chaff/src/grade/summary.ts";
import { defaultVerdict } from "../packages/chaff/src/grade/verdict.ts";
import { rubricVerdict } from "../packages/chaff/src/grade/rubric-verdict.ts";
import type { GradeContexts, GradeResult } from "../packages/chaff/src/grade/result.ts";
import { grade } from "../packages/chaff/src/grade-api.ts";
import { runCli } from "./cli-run.ts";
import { fact, jsonl, resultsIn } from "./grade-run.ts";

// Support from supplied contexts: each checkable fact of an answer looked for in the retrieved passages, never its meaning.

const VOCABULARY: ItemVocabulary = { isLanguage: (language) => ["ja", "en"].includes(language), genres: ["blog/tech"] };

const problemsOf = (text: string): string[] => {
  const parsed = parseItems(text, VOCABULARY);
  return "problems" in parsed ? parsed.problems.map((problem) => `${String(problem.line)}:${problem.kind}`) : [];
};

const PLANS = "# Plans\n\nThe Team plan costs $12 per user per month, billed yearly.\nIt includes 100 GB of storage per user.";
const SUPPORT = "# Support\n\nSupport answers within 4 business hours on the Team plan.\nThe help center moved on March 3, 2026.";

const contextsOf = (result: GradeResult): GradeContexts => {
  assert.ok(result.contexts !== undefined, "the result has contexts");
  return result.contexts;
};

const unsupportedOf = (result: GradeResult): string[] => contextsOf(result).unsupported.map((entry) => `${entry.kind} ${entry.text}`);

describe("contexts in the input", () => {
  it("reads an array of passages, an empty one included", () => {
    const parsed = parseItems(
      jsonl({ id: "a", output: "x", contexts: ["one", "two"] }, { id: "b", output: "y", contexts: [] }, { id: "c", output: "z" }),
      VOCABULARY,
    );
    assert.ok("items" in parsed);
    assert.deepEqual(
      parsed.items.map((item) => item.contexts),
      [["one", "two"], [], undefined],
    );
  });

  it("refuses contexts that are not an array of strings", () => {
    const cases: readonly unknown[] = ["one passage", [1], ["ok", null], { a: "b" }, [["nested"]]];
    cases.forEach((contexts) => assert.deepEqual(problemsOf(jsonl({ id: "a", output: "x", contexts })), ["1:not-contexts"], JSON.stringify(contexts)));
  });
});

describe("support from contexts", () => {
  it("finds each fact of a faithful answer in a passage, and names the passage", async () => {
    const result = await grade("The Team plan costs $12 per user per month and includes 100 GB of storage. Support answers within 4 business hours.", {
      contexts: [PLANS, SUPPORT],
    });
    assert.equal(result.pass, true, result.failedBecause.join());
    assert.deepEqual(unsupportedOf(result), []);
    const placed = contextsOf(result).supported.map((entry) => `${entry.text}@${String(entry.passage)}`);
    assert.ok(placed.includes("12@0") && placed.includes("4@1"), placed.join());
  });

  it("reports a figure no passage states, and a quotation not in any passage word for word", async () => {
    const result = await grade('The Team plan costs $15 per user per month. The page says "support answers within one hour". It moved on March 3, 2026.', {
      contexts: [PLANS, SUPPORT],
    });
    assert.deepEqual(unsupportedOf(result), ["number 15", 'quote "support answers within one hour"']);
    assert.deepEqual(result.failedBecause, ["contexts.unsupported 2 > 0"]);
  });

  it("takes a quotation found word for word, whatever its spacing", async () => {
    const result = await grade('The page says "Support  answers within 4 business hours".', { contexts: [SUPPORT] });
    assert.deepEqual(unsupportedOf(result), []);
  });

  it("finds a Japanese figure written with another width", async () => {
    const result = await grade("チームプランは月 １,２００ 円です。", { contexts: ["チームプランは 1 人あたり月 1,200 円です。"] });
    assert.deepEqual(unsupportedOf(result), []);
  });

  it("counts every fact unsupported when retrieval found no passage", async () => {
    const result = await grade("The Enterprise plan costs $40 per user per month.", { contexts: [] });
    assert.equal(contextsOf(result).passages, 0);
    assert.deepEqual(unsupportedOf(result), ["number 40", "name Enterprise"]);
    assert.equal(result.pass, false);
  });

  it("says which sentences it could not check, and that no contexts were given", async () => {
    const checked = await grade("The Team plan costs $12 per user per month. It is a good choice for most teams.", { contexts: [PLANS] });
    assert.equal(contextsOf(checked).uncheckedSentences, 1);
    assert.match(checked.notRun.map((entry) => `${entry.rule}: ${entry.reason}`).join("\n"), /contexts: 1 sentence states no number/u);
    const without = await grade("The Team plan costs $12 per user per month.");
    assert.equal(without.contexts, undefined);
    assert.ok(without.notRun.some((entry) => entry.rule === "contexts" && entry.reason.startsWith("no contexts given")));
  });
});

const contexts = (unsupported: readonly ReturnType<typeof fact>[]): GradeContexts => ({
  passages: 1,
  checked: 3,
  supported: [],
  unsupported,
  uncheckedSentences: 0,
});

describe("pass or fail with contexts", () => {
  it("fails a fact no passage states by default, and passes when there are no contexts", () => {
    const graded = { findings: [], facts: null, citations: null };
    assert.deepEqual(defaultVerdict({ ...graded, contexts: contexts([fact()]) }).failedBecause, ["contexts.unsupported 1 > 0"]);
    assert.equal(defaultVerdict({ ...graded, contexts: contexts([fact(true)]) }).pass, true);
    assert.equal(defaultVerdict(graded).pass, true);
  });

  it("reads grade.contexts and fails by what it writes", () => {
    const parsed = parseRubric({ contexts: { unsupported: 1, allow_unsupported: ["name"], required: true } });
    assert.ok("rubric" in parsed && parsed.rubric !== undefined);
    const input = { findings: [], facts: null, citations: null, size: { unit: "word" as const, value: 10 }, missingSections: [], uncited: false };
    assert.deepEqual(rubricVerdict({ ...input, contexts: contexts([fact(), fact()]) }, parsed.rubric).verdict.failedBecause, ["contexts.unsupported 2 > 1"]);
    assert.deepEqual(rubricVerdict(input, parsed.rubric).verdict.failedBecause, ["contexts.required: no contexts given"]);
  });

  it("refuses a grade.contexts it cannot read", () => {
    const problems = (raw: unknown): string[] => {
      const parsed = parseRubric({ contexts: raw });
      return "problems" in parsed ? parsed.problems.map((problem) => problem.path) : [];
    };
    assert.deepEqual(problems("all"), ["grade.contexts"]);
    assert.deepEqual(problems({ unsupported: -1 }), ["grade.contexts.unsupported"]);
    assert.deepEqual(problems({ allow_unsupported: ["meaning"] }), ["grade.contexts.allow_unsupported"]);
    assert.deepEqual(problems({ required: "yes" }), ["grade.contexts.required"]);
    assert.deepEqual(problems({ unsuported: 0 }), ["grade.contexts.unsuported"]);
  });
});

describe("contexts in results and the summary", () => {
  const result = (extra: Partial<GradeResult>): GradeResult => ({
    id: "a",
    language: "en",
    genre: "blog/tech",
    size: { unit: "word", value: 10 },
    findings: [],
    rates: {},
    notRun: [],
    facts: null,
    citations: null,
    pass: true,
    failedBecause: [],
    stamp: { chaff: "c", rules: "r", settings: "s" },
    ...extra,
  });

  it("adds up the facts checked and those in no passage, by kind; leaves the summary as it was without contexts", () => {
    const summary = summaryOf([result({ contexts: contexts([fact(), fact(true)]) }), result({ id: "b" })]);
    assert.deepEqual(summary.contexts, { outputs: 1, checked: 3, unsupported: { number: 1 } });
    assert.equal("contexts" in summaryOf([result({})]), false);
  });

  it("reads contexts back from --out, and refuses a malformed one", () => {
    assert.ok("results" in parseResults(JSON.stringify(result({ contexts: contexts([fact()]) }))));
    assert.deepEqual(parseResults(JSON.stringify({ ...result({}), contexts: { passages: 1 } })), { badLines: [1] });
  });
});

describe("chaff grade with contexts on the command line", () => {
  const items = jsonl(
    { id: "faithful", output: "The Team plan costs $12 per user per month.", contexts: [PLANS] },
    { id: "invented", output: "The Team plan costs $15 per user per month.", contexts: [PLANS] },
  );

  it("in English: fails the invented figure, and sums the facts checked", async () => {
    const run = await runCli({ "items.jsonl": items }, ["grade", "items.jsonl", "--out", "out.jsonl"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.out, /✗ invented: contexts\.unsupported 1 > 0/u);
    assert.match(run.out, /^Contexts: \d+ facts checked in 2 outputs, 1 in no passage \(number 1\)$/mu);
    assert.deepEqual(
      resultsIn(run.dir).map((entry) => entry.contexts?.unsupported.length),
      [0, 1],
    );
  });

  it("in Japanese, with a rubric that allows names to go unsupported and requires contexts", async () => {
    const ja = jsonl(
      { id: "料金", output: "チームプランは月 1,500 円です。", contexts: ["チームプランは月 1,200 円です。"] },
      { id: "無し", output: "チームプランは月 1,200 円です。" },
    );
    const yaml = "grade:\n  contexts: { unsupported: 0, allow_unsupported: [name], required: true }\n";
    const run = await runCli({ "items.jsonl": ja, "chaff.yaml": yaml }, ["grade", "items.jsonl", "--compact"], "ja_JP.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.out, /^料金\tfail\tpenalty 0\tcontexts\.unsupported 1 > 0$/mu);
    assert.match(run.out, /^無し\tfail\tpenalty 0\tcontexts\.required: no contexts given$/mu);
  });

  it("ends with 2 on contexts that are not an array of strings", async () => {
    const run = await runCli({ "items.jsonl": jsonl({ id: "a", output: "x", contexts: [1] }) }, ["grade", "items.jsonl"], "en_US.UTF-8");
    assert.equal(run.code, 2);
    assert.match(run.err, /line 1: contexts must be an array of strings/u);
  });
});
