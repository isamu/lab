import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { toScorer } from "../packages/chaff/src/grade/scorer.ts";
import type { GradeResult } from "../packages/chaff/src/grade/result.ts";
import { chaffScorer } from "../examples/evals/autoevals/chaff-scorer.mjs";
import { toChaffItems } from "../examples/evals/openai-evals/to-chaff.mjs";
import { runCli } from "./cli-run.ts";
import { finding, jsonl } from "./grade-run.ts";

// The scorer projection, and the eval-framework examples that run without their framework, a network or an API key.

const EXAMPLES = join(fileURLToPath(new URL(".", import.meta.url)), "..", "examples", "evals");

const REFERENCE = "# Support report\n\nThe team answered 4,812 tickets.\nThe median first reply fell from 6 hours to 2.5 hours.\n";
const DROPPED = "# Support report\n\nThe team answered 4,812 tickets, and replies got faster.\n";

const result = (overrides: Partial<GradeResult>): GradeResult => ({
  id: "a",
  language: "en",
  genre: "blog/tech",
  size: { unit: "word", value: 100 },
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

describe("the scorer projection", () => {
  it("scores a pass 1 and says so", () => {
    const scored = toScorer(result({}));
    assert.deepEqual([scored.name, scored.score, scored.pass, scored.reason], ["chaff", 1, true, "passed — no findings"]);
  });

  it("scores a fail 0, gives the failed conditions first, then the findings and the penalty, and keeps the rest as metadata", () => {
    const failed = result({
      pass: false,
      failedBecause: ["facts.dropped 2 > 0", "rules.closing-cliche 2 > 0"],
      findings: [finding("warning", "closing-cliche"), finding("info", "ai-tell"), finding("warning", "closing-cliche")],
      score: { penalty: 6, items: [] },
    });
    const scored = toScorer(failed);
    assert.equal(scored.score, 0);
    assert.equal(scored.reason, "failed: facts.dropped 2 > 0; rules.closing-cliche 2 > 0 — 3 findings: ai-tell ×1, closing-cliche ×2 — penalty 6");
    assert.deepEqual(scored.metadata.score, { penalty: 6, items: [] });
    assert.equal("pass" in scored.metadata, false);
  });
});

type GradingResult = { readonly pass: boolean; readonly score: number; readonly reason: string };

const isAssertion = (value: unknown): value is (output: string, context: { vars?: Record<string, unknown> }) => Promise<GradingResult> =>
  typeof value === "function";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isSample = (value: unknown): value is { input: unknown; ideal: string | string[] } =>
  isRecord(value) && (typeof value["ideal"] === "string" || Array.isArray(value["ideal"]));

const isCompletion = (value: unknown): value is { sample: number; completion: string } =>
  isRecord(value) && typeof value["sample"] === "number" && typeof value["completion"] === "string";

describe("the examples", () => {
  it("promptfoo: the assertion fails an output that dropped a figure of the reference var", async () => {
    const assertion: unknown = createRequire(import.meta.url)(join(EXAMPLES, "promptfoo", "chaff-assertion.cjs"));
    assert.ok(isAssertion(assertion));
    const failed = await assertion(DROPPED, { vars: { reference: REFERENCE } });
    assert.deepEqual([failed.pass, failed.score], [false, 0]);
    assert.match(failed.reason, /^failed: facts\.dropped 2 > 0/u);
    const kept = await assertion(REFERENCE, { vars: { reference: REFERENCE } });
    assert.deepEqual([kept.pass, kept.score], [true, 1]);
  });

  it("autoevals: the scorer takes expected as the reference and returns name, score and metadata", async () => {
    const scored = await chaffScorer({ output: DROPPED, expected: REFERENCE });
    assert.deepEqual([scored.name, scored.score], ["chaff", 0]);
    assert.match(String(scored.metadata.reason), /facts\.dropped/u);
  });

  it("OpenAI Evals: samples and completions become a chaff grade items file, ideal as the reference", async () => {
    const read = (name: string): unknown[] =>
      readFileSync(join(EXAMPLES, "openai-evals", name), "utf8")
        .trim()
        .split("\n")
        .map((line): unknown => JSON.parse(line));
    const samples = read("samples.jsonl").filter(isSample);
    const completions = read("completions.jsonl").filter(isCompletion);
    assert.deepEqual([samples.length, completions.length], [2, 2]);
    const items = toChaffItems(samples, completions);
    assert.deepEqual(
      items.map((item) => item.id),
      ["sample-0", "sample-1"],
    );
    assert.throws(() => toChaffItems([{ input: "q", ideal: ["one", "two"] }], [{ sample: 0, completion: "one" }]), /sample 0 has 2 ideal answers/u);
    assert.deepEqual(
      toChaffItems([{ input: "q", ideal: ["one"] }], [{ sample: 0, completion: "one" }]).map((item) => item.reference),
      ["one"],
    );
    const run = await runCli({ "items.jsonl": jsonl(...items) }, ["grade", "items.jsonl", "--compact"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.out, /^sample-0\tpass\nsample-1\tfail\tfacts\.dropped 1 > 0, facts\.added 1 > 0/u);
  });
});
