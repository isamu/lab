import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRubric, type Rubric } from "../packages/chaff/src/grade/rubric.ts";
import { rubricVerdict, scoreOf, type RubricInput } from "../packages/chaff/src/grade/rubric-verdict.ts";
import { runCli } from "./cli-run.ts";
import { fact, finding, isSummary, jsonl, resultsIn } from "./grade-run.ts";

// The grade: rubric in chaff.yaml: how it is read, what fails an output under it, and the penalty score whose every
// point names a finding.

const rubricOf = (raw: unknown): Rubric => {
  const parsed = parseRubric(raw);
  assert.ok("rubric" in parsed && parsed.rubric !== undefined, JSON.stringify(parsed));
  return parsed.rubric;
};

const problemPaths = (raw: unknown): string[] => {
  const parsed = parseRubric(raw);
  return "problems" in parsed ? parsed.problems.map((problem) => `${problem.path}:${problem.expected}`) : [];
};

describe("reading grade:", () => {
  it("reads every part of the rubric the spec names", () => {
    const rubric = rubricOf({
      rules: { "total-mismatch": { max: 0 }, "closing-cliche": { max: 0, weight: 3 }, "ai-tell": { max_rate: 5, weight: 2 } },
      required_sections: ["結論", " 根拠 "],
      facts: { dropped: 0, added: 1, allow_dropped: ["heading"] },
      citations: { failed: 0, required: true },
      penalty: 10,
    });
    assert.deepEqual(rubric.rules["ai-tell"], { max: undefined, maxRate: 5, weight: 2 });
    assert.deepEqual(rubric.requiredSections, ["結論", "根拠"]);
    assert.deepEqual(rubric.facts, { dropped: 0, added: 1, allowDropped: ["heading"], allowAdded: [] });
    assert.deepEqual(rubric.citations, { failed: 0, required: true });
    assert.equal(rubric.penalty, 10);
  });

  it("is no rubric when chaff.yaml has no grade:, and an empty one when grade: is bare or an empty map", () => {
    assert.deepEqual(parseRubric(undefined), { rubric: undefined });
    assert.deepEqual(parseRubric(null), { rubric: { rules: {} } });
    assert.deepEqual(rubricOf({}).rules, {});
  });

  it("names the place and the kind of every value it cannot read, so no limit is silently dropped", () => {
    assert.deepEqual(problemPaths("strict"), ["grade:map"]);
    assert.deepEqual(problemPaths({ rules: [] }), ["grade.rules:map"]);
    assert.deepEqual(problemPaths({ rules: { "ai-tell": 3 } }), ["grade.rules.ai-tell:map"]);
    assert.deepEqual(problemPaths({ rules: { "ai-tell": { max: 1.5, max_rate: -1, weight: "2", max_rte: 4 } } }), [
      "grade.rules.ai-tell.max:count",
      "grade.rules.ai-tell.max_rate:number",
      "grade.rules.ai-tell.weight:number",
      "grade.rules.ai-tell.max_rte:known-key",
    ]);
    assert.deepEqual(problemPaths({ required_sections: "結論" }), ["grade.required_sections:words"]);
    assert.deepEqual(problemPaths({ required_sections: ["結論", ""] }), ["grade.required_sections:words"]);
    assert.deepEqual(problemPaths({ facts: { dropped: -1, allow_dropped: ["colour"] } }), ["grade.facts.dropped:count", "grade.facts.allow_dropped:kinds"]);
    assert.deepEqual(problemPaths({ citations: { required: "yes" } }), ["grade.citations.required:boolean"]);
    assert.deepEqual(problemPaths({ penalty: "10", weights: {} }), ["grade.penalty:number", "grade.weights:known-key"]);
  });
});

const input = (overrides: Partial<RubricInput>): RubricInput => ({
  findings: [],
  facts: null,
  citations: null,
  size: { unit: "word", value: 500 },
  missingSections: [],
  uncited: false,
  ...overrides,
});

const reasons = (rubric: Rubric, overrides: Partial<RubricInput>): readonly string[] => rubricVerdict(input(overrides), rubric).verdict.failedBecause;

describe("pass or fail under a rubric", () => {
  it("fails a rule past its count or its rate, and not at it", () => {
    const rubric = rubricOf({ rules: { "closing-cliche": { max: 1 }, "ai-tell": { max_rate: 4 } } });
    assert.deepEqual(reasons(rubric, { findings: [finding("warning", "closing-cliche")] }), []);
    assert.deepEqual(reasons(rubric, { findings: [finding("warning", "closing-cliche"), finding("warning", "closing-cliche")] }), [
      "rules.closing-cliche 2 > 1",
    ]);
    assert.deepEqual(reasons(rubric, { findings: [finding("info", "ai-tell"), finding("info", "ai-tell")] }), []);
    assert.deepEqual(reasons(rubric, { findings: [finding("info", "ai-tell"), finding("info", "ai-tell"), finding("info", "ai-tell")] }), [
      "rules.ai-tell.rate 6 > 4",
    ]);
  });

  it("checks a rate against its limit unrounded: one finding in three words is over 333.3 per 1,000", () => {
    const rubric = rubricOf({ rules: { "ai-tell": { max_rate: 333.3 } } });
    const failed = reasons(rubric, { findings: [finding("info", "ai-tell")], size: { unit: "word", value: 3 } });
    assert.equal(failed.length, 1);
    assert.deepEqual(failed, ["rules.ai-tell.rate 333.333 > 333.3"]);
  });

  it("turns the default off with a bare grade:, so an error finding of an unnamed rule no longer fails", async () => {
    const items = jsonl({ id: "a", output: "# Quote\n\n| Item | Price |\n| --- | --- |\n| Design | $400 |\n| Build | $1,200 |\n| Total | $1,500 |\n" });
    const bare = await runCli(
      { "items.jsonl": items, "chaff.yaml": "grade:\n" },
      ["grade", "items.jsonl", "--experimental", "--out", "out.jsonl"],
      "en_US.UTF-8",
    );
    const none = await runCli({ "items.jsonl": items }, ["grade", "items.jsonl", "--experimental", "--out", "out.jsonl"], "en_US.UTF-8");
    assert.deepEqual([bare.code, none.code], [0, 1]);
    assert.notEqual(resultsIn(bare.dir)[0]?.stamp.settings, resultsIn(none.dir)[0]?.stamp.settings);
  });

  it("decides only by what it names: an error finding of another rule is a rate, not a failure", () => {
    assert.deepEqual(reasons(rubricOf({ rules: { "closing-cliche": { max: 0 } } }), { findings: [finding("error", "total-mismatch")] }), []);
  });

  it("fails a missing required section and names it", () => {
    assert.deepEqual(reasons(rubricOf({}), { missingSections: ["根拠"] }), ["required_sections.missing 1 > 0: 根拠"]);
  });

  it("counts facts only against the limits written, and never the kinds allowed to change", () => {
    const facts = { dropped: [fact(), fact(true)], added: [fact()], reformed: 0 };
    assert.deepEqual(reasons(rubricOf({ facts: { dropped: 0 } }), { facts }), ["facts.dropped 1 > 0"]);
    assert.deepEqual(reasons(rubricOf({ facts: { added: 1 } }), { facts }), []);
    assert.deepEqual(reasons(rubricOf({ facts: { added: 0 } }), { facts }), ["facts.added 1 > 0"]);
    assert.deepEqual(reasons(rubricOf({}), { facts }), []);
  });

  it("fails failed quotations past the limit, and sources given without citations when they are required", () => {
    const citations = { checked: 2, failed: [{ source: "s", address: "1", quote: "q", status: "quote-not-found" as const }] };
    assert.deepEqual(reasons(rubricOf({ citations: { failed: 0 } }), { citations }), ["citations.failed 1 > 0"]);
    assert.deepEqual(reasons(rubricOf({ citations: { required: true } }), { uncited: true }), ["citations.required: sources given, no citations"]);
    assert.deepEqual(reasons(rubricOf({ citations: { required: false } }), { uncited: true }), []);
  });

  it("fails when the penalty points add up to more than the limit", () => {
    const rubric = rubricOf({ rules: { "closing-cliche": { weight: 3 } }, penalty: 5 });
    assert.deepEqual(reasons(rubric, { findings: [finding("warning", "closing-cliche")] }), []);
    assert.deepEqual(reasons(rubric, { findings: [finding("warning", "closing-cliche"), finding("warning", "closing-cliche")] }), ["score.penalty 6 > 5"]);
  });
});

describe("the penalty score", () => {
  it("gives each finding of a weighted rule its points and line, and sums them; other findings cost nothing", () => {
    const rubric = rubricOf({ rules: { "closing-cliche": { weight: 3 }, "ai-tell": { weight: 0.5 }, "padded-intro": { max: 0 } } });
    const score = scoreOf(
      { findings: [finding("warning", "closing-cliche", 4), finding("info", "ai-tell", 2), finding("warning", "padded-intro", 1)] },
      rubric,
    );
    assert.deepEqual(score, {
      penalty: 3.5,
      items: [
        { points: 3, rule: "closing-cliche", line: 4 },
        { points: 0.5, rule: "ai-tell", line: 2 },
      ],
    });
  });

  it("is zero with nothing weighted: zero means no counted finding, not a perfect text", () => {
    assert.deepEqual(scoreOf({ findings: [finding("warning", "closing-cliche")] }, rubricOf({ rules: { "closing-cliche": { weight: 0 } } })), {
      penalty: 0,
      items: [],
    });
  });
});

const EN_YAML = [
  "grade:",
  "  rules:",
  "    closing-cliche: { max: 0, weight: 3 }",
  "    max-sentence-length: { weight: 1 }",
  "    no-such-rule: { max: 0 }",
  "  required_sections: [Summary]",
  "  facts: { dropped: 0, allow_dropped: [heading] }",
  "  penalty: 10",
  "",
].join("\n");

const EN_REFERENCE = "# Weekly report\n\n## Releases\n\nWe shipped 3 releases this week.\n";

describe("chaff grade with a rubric", () => {
  it("in English: fails by the rubric, scores each finding, honours allow_dropped, and lists an unknown rule as not run", async () => {
    const items = jsonl(
      { id: "plain", output: "# Summary\n\nWe shipped 3 releases this week.\n", reference: EN_REFERENCE },
      { id: "cliche", output: "# Summary\n\nWe shipped 3 releases.\n\nIn conclusion, I hope this helps!\n", reference: EN_REFERENCE },
      { id: "no-summary", output: "# Notes\n\nWe shipped 3 releases this week.\n" },
    );
    const run = await runCli({ "items.jsonl": items, "chaff.yaml": EN_YAML }, ["grade", "items.jsonl", "--out", "out.jsonl", "--compact"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /grade\.rules\.no-such-rule: named under grade: but not a rule chaff knows/u);
    assert.equal(
      run.out,
      [
        "plain\tpass\tpenalty 0",
        "cliche\tfail\tpenalty 3\trules.closing-cliche 1 > 0",
        "no-summary\tfail\tpenalty 0\trequired_sections.missing 1 > 0: Summary",
        "items.jsonl: 3 outputs, 1 passed, 2 failed",
      ].join("\n"),
    );
    const [plain, cliche] = resultsIn(run.dir);
    assert.deepEqual(
      plain?.facts?.dropped.map((entry) => [entry.kind, entry.allowed]),
      [["heading", true]],
    );
    assert.deepEqual(cliche?.score, { penalty: 3, items: [{ points: 3, rule: "closing-cliche", line: 5 }] });
    assert.ok(cliche?.notRun.some((entry) => entry.rule === "no-such-rule"));
  });

  it("in Japanese: a summary with the penalty total, and no score at all without grade:", async () => {
    const yaml = "grade:\n  rules:\n    total-mismatch: { max: 0, weight: 5 }\n";
    const items = jsonl({
      id: "見積",
      output: "# お見積り\n\n| 項目 | 金額 |\n| --- | --- |\n| 設計 | 40,000円 |\n| 実装 | 120,000円 |\n| 合計 | 150,000円 |\n",
    });
    const graded = await runCli({ "items.jsonl": items, "chaff.yaml": yaml }, ["grade", "items.jsonl", "--experimental"], "ja_JP.UTF-8");
    assert.equal(graded.code, 1);
    assert.match(graded.out, /✗ 見積: rules\.total-mismatch 1 > 0/u);
    assert.match(graded.out, /減点の和: 5/u);
    const plain = await runCli({ "items.jsonl": items }, ["grade", "items.jsonl", "--experimental", "--json", "--out", "out.jsonl"], "ja_JP.UTF-8");
    const summary: unknown = JSON.parse(plain.out);
    assert.ok(isSummary(summary));
    assert.equal(summary.penalty, undefined);
    assert.equal(resultsIn(plain.dir)[0]?.score, undefined);
  });

  it("fails an output given sources but no citations when citations are required, and passes one that cites", async () => {
    const policy = "# Refunds\n\n2.1 A refund is paid within 10 business days.\n";
    const items = jsonl(
      { id: "uncited", output: "Refunds take 10 business days.", sources: { policy } },
      { id: "cited", output: "Refunds take 10 business days (2.1).", sources: { policy }, citations: [{ address: "2.1", quote: "within 10 business days" }] },
    );
    const run = await runCli(
      { "items.jsonl": items, "chaff.yaml": "grade:\n  citations: { failed: 0, required: true }\n" },
      ["grade", "items.jsonl", "--compact"],
      "en_US.UTF-8",
    );
    assert.equal(
      run.out.split("\n").slice(0, 2).join("\n"),
      "uncited\tfail\tpenalty 0\tcitations.required: sources given, no citations\ncited\tpass\tpenalty 0",
    );
  });

  it("ends with 2 on a rubric it cannot read, naming the place, before grading anything", async () => {
    const run = await runCli(
      { "items.jsonl": jsonl({ id: "a", output: "x" }), "chaff.yaml": "grade:\n  rules:\n    ai-tell: { max_rte: 3 }\n" },
      ["grade", "items.jsonl"],
      "ja_JP.UTF-8",
    );
    assert.equal(run.code, 2);
    assert.match(run.err, /grade\.rules\.ai-tell\.max_rte/u);
    assert.equal(run.out, "");
  });

  it("stamps another settings hash when the rubric changes", async () => {
    const items = jsonl({ id: "a", output: "A note." });
    // One after another: runCli changes the working directory.
    const ten = await runCli({ "items.jsonl": items, "chaff.yaml": "grade:\n  penalty: 10\n" }, ["grade", "items.jsonl", "--out", "out.jsonl"], "en_US.UTF-8");
    const twenty = await runCli(
      { "items.jsonl": items, "chaff.yaml": "grade:\n  penalty: 20\n" },
      ["grade", "items.jsonl", "--out", "out.jsonl"],
      "en_US.UTF-8",
    );
    const [first, second] = [ten, twenty].map((run) => resultsIn(run.dir)[0]?.stamp);
    assert.equal(first?.rules, second?.rules);
    assert.notEqual(first?.settings, second?.settings);
  });
});
