import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { genreStop } from "../packages/chaff/src/run.ts";
import { presetLevels } from "../packages/chaff/src/genre-load.ts";
import { REASONS } from "../packages/chaff/src/reasons.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

const ruleOf = (id: string): RuleDefinition => {
  const rule = loadRules("en").find((entry) => entry.id === id);
  if (rule === undefined) throw new Error(`no rule ${id}`);
  return rule;
};

const stopIn = (id: string, genre: string, settings: Record<string, "strict" | "normal" | "relaxed" | "off"> = {}): string | undefined =>
  genreStop(ruleOf(id), settings, presetLevels(genre), genre, REASONS.en);

const nowOf = (out: string): string | undefined =>
  out
    .split("\n")
    .find((line) => line.includes("Now:") || line.includes("いまは"))
    ?.trim();

describe("genreStop: why the genre keeps a rule from running", () => {
  it("a genre outside use_for stops the rule, whatever chaff.yaml says", () => {
    assert.equal(stopIn("agentless-passive", "blog/tech"), "the blog/tech genre does not check it");
    assert.equal(stopIn("agentless-passive", "technical/spec", { "agentless-passive": "strict" }), "the technical/spec genre does not check it");
  });

  it("a genre off_for turns off stops it, unless chaff.yaml names the rule", () => {
    assert.equal(stopIn("agentless-passive", "business/meeting-notes"), "the business/meeting-notes genre does not check it");
    assert.equal(stopIn("agentless-passive", "business/meeting-notes", { "agentless-passive": "strict" }), undefined);
  });

  it("a genre the rule runs in does not stop it", () => {
    assert.equal(stopIn("adverb-without-negation", "technical/spec"), undefined);
    assert.equal(stopIn("adverb-without-negation", "business/proposal"), undefined);
  });
});

describe("explain: a rule the genre does not run says so, as a run lists it", () => {
  it("English: the reason in explain is the one the run gives", async () => {
    const files = { "chaff.yaml": "language: en\n", "a.md": "The file was deleted. The report was written.\n" };
    const explained = await runCli(files, ["explain", "agentless-passive", "--genre", "blog/tech"], "en_US.UTF-8");
    assert.equal(nowOf(explained.out), "Now: not run (the blog/tech genre does not check it).");
    assert.doesNotMatch(explained.out, /→/u);
    const run = await runCli(files, ["a.md", "--genre", "blog/tech"], "en_US.UTF-8");
    assert.match(run.both, /agentless-passive \(the blog\/tech genre does not check it\)/u);
  });

  it("Japanese: the same, in the run's words", async () => {
    const explained = await runCli({ "chaff.yaml": "language: ja\n" }, ["explain", "adverb-without-negation", "--genre", "blog/tech"]);
    assert.equal(nowOf(explained.out), "いまは動きません（ジャンル blog/tech では見ないため）。");
  });

  it("a genre the rule runs in still shows its level", async () => {
    const explained = await runCli({ "chaff.yaml": "language: ja\n" }, ["explain", "adverb-without-negation", "--genre", "business/proposal"]);
    assert.equal(nowOf(explained.out), "いまは normal です。");
    const named = await runCli(
      { "chaff.yaml": "language: en\nrules:\n  agentless-passive: strict\n" },
      ["explain", "agentless-passive", "--genre", "business/meeting-notes"],
      "en_US.UTF-8",
    );
    assert.match(nowOf(named.out) ?? "", /^Now: strict\./u);
  });
});
