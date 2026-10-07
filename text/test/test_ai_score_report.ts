import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { grade } from "../packages/chaff/src/grade-api.ts";
import { aiLevelCountsOf, gradeAiScoreOf, type GradeAiScore } from "../packages/chaff/src/grade/ai-score.ts";
import { parseResults } from "../packages/chaff/src/grade/results-read.ts";
import type { AiScore } from "../packages/chaff/src/ai-score/score.ts";
import { runCli } from "./cli-run.ts";
import { isSummary, jsonl, resultsIn } from "./grade-run.ts";

// The quick score where the other reports carry it: one line under each file's lint report (not with --compact), a field
// in each chaff grade result, the levels counted in the summary, and a row in the variant comparison.

const FIXTURES = join(import.meta.dirname, "fixtures", "ai-score");
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), "utf8");

const score = (level: GradeAiScore["level"]): GradeAiScore => ({
  level,
  notScored: level === null ? "too-short" : null,
  signs: 0,
  compared: 0,
  shown: [],
});

describe("the lint report", () => {
  it("ends a file's report with the level and the note that it is not a verdict", async () => {
    const run = await runCli({ "a.md": fixture("ja-ai.md") }, ["a.md", "--genre", "blog/tech"]);
    assert.match(
      run.out,
      /AI らしさ: 高（人が書いた文書（ブログ）と比べて目印が多い）: 目印 \d+ 個 ※ 書いたのが AI かどうかの判定ではありません。内訳: chaff ai-score a\.md/u,
    );
  });

  it("says a short file is not scored, in English for an English file", async () => {
    const run = await runCli({ "a.md": "# Short\n\nIn conclusion, we hope this helps.\n" }, ["a.md"], "en_US.UTF-8");
    assert.match(run.out, /AI-likeness: not scored \(too short: \d+ words?; scored from 200\)/u);
  });

  it("leaves the line out with --compact", async () => {
    const run = await runCli({ "a.md": fixture("ja-ai.md") }, ["a.md", "--genre", "blog/tech", "--compact"]);
    assert.doesNotMatch(run.out, /AI らしさ/u);
  });
});

describe("chaff grade", () => {
  it("gives each output its quick score, outside pass or fail", async () => {
    const result = await grade(fixture("en-ai.md"), { id: "a", genre: "blog/tech" });
    assert.equal(result.aiScore?.level, "high");
    assert.equal(result.aiScore?.notScored, null);
    assert.ok((result.aiScore?.shown ?? []).includes("padded-intro"));
    assert.ok(!result.failedBecause.some((reason) => reason.includes("ai")));
    const short = await grade("In conclusion, we hope this helps.", { id: "b" });
    assert.deepEqual(short.aiScore?.level, null);
    assert.equal(short.aiScore?.notScored, "too-short");
  });

  it("counts the levels in the summary, and writes them to --out", async () => {
    const items = jsonl(
      { id: "a", output: fixture("ja-ai.md"), genre: "blog/tech" },
      { id: "b", output: fixture("ja-plain.md"), genre: "blog/tech" },
      { id: "c", output: "短い。" },
    );
    const run = await runCli({ "items.jsonl": items }, ["grade", "items.jsonl", "--json", "--out", "out.jsonl"]);
    const summary: unknown = JSON.parse(run.out);
    assert.ok(isSummary(summary));
    assert.deepEqual(summary.aiScore, { low: 1, medium: 0, high: 1, notScored: 1 });
    assert.deepEqual(
      resultsIn(run.dir).map((result) => result.aiScore?.level),
      ["high", "low", null],
    );
    const text = await runCli({ "items.jsonl": items }, ["grade", "items.jsonl"]);
    assert.match(text.out, /AI らしさ: 低 1、中 0、高 1、測っていない 1（書いたのが AI かどうかの判定ではありません。合否には入りません）/u);
  });

  it("puts the levels side by side for variants", async () => {
    const items = jsonl(
      { id: "q1", variant: "A", output: fixture("en-ai.md"), genre: "blog/tech" },
      { id: "q1", variant: "B", output: fixture("en-plain.md"), genre: "blog/tech" },
    );
    const run = await runCli({ "items.jsonl": items }, ["grade", "items.jsonl"], "en_US.UTF-8");
    assert.match(run.out, /AI low\/med\/high +0\/0\/1 \(0\) +1\/0\/0 \(0\)/u);
  });
});

describe("results read back", () => {
  const line = (aiScore: unknown): string =>
    JSON.stringify({
      id: "a",
      language: "en",
      genre: "blog/tech",
      size: { unit: "word", value: 10 },
      findings: [],
      rates: {},
      notRun: [],
      facts: null,
      citations: null,
      ...(aiScore === undefined ? {} : { aiScore }),
      pass: true,
      failedBecause: [],
      stamp: { chaff: "0", rules: "r", settings: "s" },
    });

  it("accepts a result with the quick score, and one written before it existed", () => {
    assert.ok("results" in parseResults(line(score("high"))));
    assert.ok("results" in parseResults(line(undefined)));
  });

  it("refuses a quick score that is not one", () => {
    assert.ok("badLines" in parseResults(line({ level: "very high", notScored: null, signs: 1, compared: 1, shown: [] })));
    assert.ok("badLines" in parseResults(line({ level: "low", notScored: null, signs: "1", compared: 1, shown: [] })));
  });
});

describe("aiLevelCountsOf", () => {
  it("counts each level, and the outputs not scored", () => {
    assert.deepEqual(aiLevelCountsOf([score("low"), score("high"), score("high"), score(null), undefined]), { low: 1, medium: 0, high: 2, notScored: 1 });
  });

  it("is undefined when no result carries a score", () => {
    assert.equal(aiLevelCountsOf([undefined, undefined]), undefined);
    assert.equal(aiLevelCountsOf([]), undefined);
  });
});

describe("gradeAiScoreOf", () => {
  it("keeps the level, the reason, the counts and the signs that counted", () => {
    const full: AiScore = {
      group: "blog",
      level: undefined,
      notScored: { reason: "no-baseline", compared: 2, needed: 5 },
      signs: 1,
      compared: 2,
      signals: [
        { rule: "ai-tell", count: 1, human: { documents: 20, fired: 0 }, unusual: true },
        { rule: "no-em-dash", count: 0, human: { documents: 20, fired: 0 }, unusual: false },
      ],
      structure: undefined,
      together: { fired: ["ai-tell"], counted: false },
    };
    assert.deepEqual(gradeAiScoreOf(full), { level: null, notScored: "no-baseline", signs: 1, compared: 2, shown: ["ai-tell"] });
  });
});
