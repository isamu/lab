import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runCli } from "./cli-run.ts";
import { aiScoreSharesOf } from "../scripts/ai-score-shares.ts";
import { allRules, readMeasurement } from "../scripts/rules-measure-files.ts";
import { HUMAN_SHARES } from "../packages/chaff/src/ai-score/human-shares.ts";

// chaff ai-score: the quick score on the command line, its JSON, and the human shares it reads.

const FIXTURES = join(import.meta.dirname, "fixtures", "ai-score");
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), "utf8");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const firstDocument = (out: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(out);
  assert.ok(Array.isArray(parsed));
  const first: unknown = parsed[0];
  assert.ok(isRecord(first));
  return first;
};

/** Words that would say who wrote the text. The score never says it. */
const AUTHORSHIP_JA = /AI が書いた|AIが書いた|生成された文章です|人が書いた文章です/u;
const AUTHORSHIP_EN = /written by (?:an )?AI|AI[- ]generated|was generated|is human-written/iu;

describe("chaff ai-score", () => {
  it("prints the level, the signs and the note that it is not a verdict, in Japanese", async () => {
    const run = await runCli({ "a.md": fixture("ja-ai.md") }, ["ai-score", "a.md", "--genre", "blog/tech"]);
    assert.equal(run.code, 0, run.both);
    assert.match(run.out, /AI らしさ: 高（人が書いた文書（ブログ）と比べて目印が多い）/u);
    assert.match(run.out, /※ 書いたのが AI かどうかの判定ではありません/u);
    assert.match(run.out, /✗ 予告で始まる文が多い: \d+ 件 {2}人が書いた文書（ブログ）\d+ 本のうち 0 本/u);
    assert.doesNotMatch(run.out, AUTHORSHIP_JA);
  });

  it("speaks English for an English document", async () => {
    const run = await runCli({ "a.md": fixture("en-plain.md") }, ["ai-score", "a.md", "--genre", "blog/tech"], "en_US.UTF-8");
    assert.equal(run.code, 0, run.both);
    assert.match(run.out, /AI-likeness: low \(about as many signs as human-written documents \(Blog\)\)/u);
    assert.match(run.out, /Not a verdict on whether AI wrote it/u);
    assert.doesNotMatch(run.out, AUTHORSHIP_EN);
  });

  it("says a short text is not scored, and why, instead of a level", async () => {
    const run = await runCli({ "a.md": "# 短い\n\nいかがでしたでしょうか。\n" }, ["ai-score", "a.md", "--genre", "blog/tech"]);
    assert.equal(run.code, 0, run.both);
    assert.match(run.out, /AI らしさ: 測っていません（短すぎます: \d+ 字。500 字から測ります）/u);
    assert.doesNotMatch(run.out, /AI らしさ: [低中高]/u);
  });

  it("gives each file as JSON: the level, the signs, each signal with its human share, the structure", async () => {
    const run = await runCli({ "a.md": fixture("en-ai.md") }, ["ai-score", "a.md", "--genre", "blog/tech", "--format", "json"]);
    assert.equal(run.code, 0, run.both);
    const document = firstDocument(run.out);
    assert.deepEqual(Object.keys(document), [
      "path",
      "language",
      "genre",
      "level",
      "notScored",
      "group",
      "signs",
      "compared",
      "thresholds",
      "signals",
      "structure",
      "together",
    ]);
    assert.equal(document["level"], "high");
    assert.equal(document["notScored"], null);
    assert.equal(document["group"], "blog");
    assert.deepEqual(document["thresholds"], { medium: 3, high: 5, together: 2 });
    const together = document["together"];
    assert.ok(isRecord(together));
    assert.equal(together["counted"], true);
    assert.ok(Array.isArray(together["fired"]) && together["fired"].includes("padded-intro"));
    const signals = document["signals"];
    assert.ok(Array.isArray(signals));
    const padded: unknown = signals.find((signal: unknown) => isRecord(signal) && signal["rule"] === "padded-intro");
    assert.ok(isRecord(padded));
    assert.equal(padded["unusual"], true);
    assert.ok(isRecord(padded["human"]));
    const structure = document["structure"];
    assert.ok(Array.isArray(structure));
    assert.ok(structure.every((place: unknown) => isRecord(place) && "beyond" in place && "sameAs" in place));
  });

  it("gives a short text as not scored in JSON, with a null level", async () => {
    const run = await runCli({ "a.md": "# Short\n\nIn conclusion, we hope this helps.\n" }, ["ai-score", "a.md", "--json"], "en_US.UTF-8");
    const document = firstDocument(run.out);
    assert.equal(document["level"], null);
    assert.ok(isRecord(document["notScored"]));
    assert.equal(document["notScored"]["reason"], "too-short");
  });

  it("prints one line per file with --compact", async () => {
    const run = await runCli({ "a.md": fixture("ja-plain.md"), "b.md": fixture("ja-ai.md") }, [
      "ai-score",
      "a.md",
      "b.md",
      "--genre",
      "blog/tech",
      "--compact",
    ]);
    assert.equal(run.code, 0, run.both);
    const lines = run.out.split("\n");
    assert.equal(lines.length, 2);
    assert.match(lines[0] ?? "", /^a\.md: ai-score low /u);
    assert.match(lines[1] ?? "", /^b\.md: ai-score high /u);
  });

  it("ends with 1 and says how to use it, given no file or an unknown format", async () => {
    const none = await runCli({}, ["ai-score"]);
    assert.equal(none.code, 1);
    assert.match(none.err, /chaff ai-score <file>/u);
    const format = await runCli({ "a.md": "x" }, ["ai-score", "a.md", "--format", "xml"]);
    assert.equal(format.code, 1);
    assert.match(format.err, /--format/u);
  });

  it("ends with 1 when a file cannot be read", async () => {
    assert.equal((await runCli({}, ["ai-score", "missing.md"])).code, 1);
  });
});

describe("the human shares", () => {
  it("are corpus/rules-measure.json's groups for the scored signals (node scripts/ai-score-shares.ts rewrites them)", () => {
    assert.deepEqual(HUMAN_SHARES, aiScoreSharesOf(readMeasurement(), allRules()));
  });
});
