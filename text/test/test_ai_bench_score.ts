import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedOn, formatRows, ruleRows, type BenchRun } from "../scripts/ai-bench-score.ts";

const run = (pile: BenchRun["pile"], id: string, ...fired: string[]): BenchRun => ({ pile, id, fired: new Set(fired) });

const RUNS: readonly BenchRun[] = [
  run("ai", "tech/ai.md", "ai-tell", "announcing-opener"),
  run("ai", "essay/ai.md", "announcing-opener"),
  run("human", "tech/human.md"),
  run("human", "essay/human.md", "ai-tell"),
  run("rewritten", "tech/rewritten.md"),
  run("corpus", "doc-a", "announcing-opener"),
  run("corpus", "doc-b"),
  run("corpus", "doc-c"),
];

describe("ruleRows", () => {
  it("counts, per pile, the documents a rule fired on out of the pile's documents", () => {
    const [aiTell, opener] = ruleRows(RUNS, ["ai-tell", "announcing-opener"]);
    assert.deepEqual(aiTell?.rates, { ai: { fired: 1, of: 2 }, human: { fired: 1, of: 2 }, rewritten: { fired: 0, of: 1 }, corpus: { fired: 0, of: 3 } });
    assert.deepEqual(opener?.rates, { ai: { fired: 2, of: 2 }, human: { fired: 0, of: 2 }, rewritten: { fired: 0, of: 1 }, corpus: { fired: 1, of: 3 } });
  });

  it("keeps the order of the rules given, and a rule that never fired", () => {
    assert.deepEqual(
      ruleRows(RUNS, ["stock-transition", "ai-tell"]).map((row) => row.rule),
      ["stock-transition", "ai-tell"],
    );
    assert.deepEqual(ruleRows(RUNS, ["stock-transition"])[0]?.rates.ai, { fired: 0, of: 2 });
  });

  it("reads an empty pile as 0 of 0, not as a failure", () => {
    assert.deepEqual(ruleRows([], ["ai-tell"])[0]?.rates.corpus, { fired: 0, of: 0 });
  });
});

describe("formatRows", () => {
  it("prints a header and one aligned line per rule", () => {
    const lines = formatRows(ruleRows(RUNS, ["ai-tell", "announcing-opener"]));
    assert.equal(lines.length, 3);
    assert.match(lines[0] ?? "", /^rule\s+hits \(b\) ai {2}false \(a\) human {2}false \(c\) rewritten {2}false corpus$/u);
    assert.match(lines[1] ?? "", /^ai-tell\s+1\/2\s+1\/2\s+0\/1\s+0\/3$/u);
    assert.equal(lines[1]?.indexOf("1/2"), lines[2]?.indexOf("2/2"));
  });
});

describe("firedOn", () => {
  it("lists the documents of a pile that fired something, with the rules sorted", () => {
    assert.deepEqual(firedOn(RUNS, "ai"), ["tech/ai.md: ai-tell, announcing-opener", "essay/ai.md: announcing-opener"]);
    assert.deepEqual(firedOn(RUNS, "rewritten"), []);
  });
});
