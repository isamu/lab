import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { grade, GradeInputError, type GradeOptions } from "../packages/chaff/src/grade-api.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { runCli } from "./cli-run.ts";
import { jsonl, resultsIn } from "./grade-run.ts";

// chaffjs/grade: grade() for an in-process harness. The same result as chaff grade's --out line, files read only when named.

const EN_SOURCE = "# Support report\n\nThe team answered 4,812 tickets.\nThe median first reply fell from 6 hours to 2.5 hours.\n";
const EN_OUTPUT = "# Support report\n\nThe team answered 4,812 tickets, and replies got faster.\n\nIn conclusion, I hope this helps!\n";

const JA_POLICY = "# 返金の決まり\n\n## 2. 返金\n\n2.1 お届けから 30 日以内なら返金を求められる。\n\n2.2 送料は返金しない。\n";

const isGradeEntry = (value: unknown): value is { readonly grade: typeof grade } =>
  typeof value === "object" && value !== null && "grade" in value && typeof value.grade === "function";

const rejection = async (output: string, options: GradeOptions): Promise<readonly string[]> => {
  try {
    await grade(output, options);
  } catch (error) {
    assert.ok(error instanceof GradeInputError, String(error));
    return error.problems;
  }
  return assert.fail("grade() did not throw");
};

const inDirectory = async <T>(dir: string, run: () => Promise<T>): Promise<T> => {
  const saved = process.cwd();
  process.chdir(dir);
  try {
    return await run();
  } finally {
    process.chdir(saved);
  }
};

describe("grade()", () => {
  it("in English: fails an output that dropped facts, and gives the same result as chaff grade --out", async () => {
    const result = await grade(EN_OUTPUT, { id: "summary", reference: EN_SOURCE });
    assert.equal(result.pass, false);
    assert.deepEqual(result.failedBecause, ["facts.dropped 2 > 0"]);
    assert.deepEqual(
      result.findings.map((finding) => finding.rule),
      ["closing-cliche"],
    );
    const run = await runCli(
      { "items.jsonl": jsonl({ id: "summary", output: EN_OUTPUT, reference: EN_SOURCE }) },
      ["grade", "items.jsonl", "--out", "out.jsonl"],
      "en_US.UTF-8",
    );
    assert.deepEqual(resultsIn(run.dir)[0], result);
  });

  it("in Japanese: checks quotations against the one source without naming it", async () => {
    const result = await grade("30 日以内なら返金される（2.1）。", {
      sources: { policy: JA_POLICY },
      citations: [
        { address: "2.1", quote: "お届けから 30 日以内なら返金を求められる" },
        { address: "2.2", quote: "送料も返金する" },
      ],
    });
    assert.deepEqual([result.id, result.language, result.pass], ["output", "ja", false]);
    assert.deepEqual(
      result.citations?.failed.map((citation) => [citation.source, citation.address, citation.status]),
      [["policy", "2.2", "quote-not-found"]],
    );
  });

  it("reads chaff.yaml only when config names it, and takes settings already read", async () => {
    const dir = mkdtempSync(join(tmpdir(), "chaff-grade-api-"));
    writeFileSync(join(dir, "chaff.yaml"), "grade:\n  rules:\n    closing-cliche: { max: 0, weight: 3 }\n");
    const unnamed = await inDirectory(dir, () => grade(EN_OUTPUT));
    assert.deepEqual([unnamed.pass, unnamed.score], [true, undefined]);
    const named = await grade(EN_OUTPUT, { config: join(dir, "chaff.yaml") });
    assert.deepEqual([named.pass, named.score?.penalty, named.failedBecause], [false, 3, ["rules.closing-cliche 1 > 0"]]);
    const given = await grade(EN_OUTPUT, { config: { ...EMPTY, grade: { rules: { "closing-cliche": { weight: 1 } } } } });
    assert.deepEqual([given.pass, given.score?.penalty], [true, 1]);
    assert.equal(named.stamp.rules, given.stamp.rules);
    assert.notEqual(named.stamp.settings, given.stamp.settings);
  });

  it("runs the experimental rules when asked, and stamps that", async () => {
    const quote = "# Quote\n\n| Item | Price |\n| --- | --- |\n| Design | $400 |\n| Build | $1,200 |\n| Total | $1,500 |\n";
    const plain = await grade(quote);
    const experimental = await grade(quote, { experimental: true });
    assert.deepEqual([plain.pass, experimental.pass], [true, false]);
    assert.deepEqual(experimental.failedBecause, ["findings.error 1 > 0"]);
    assert.notEqual(plain.stamp.settings, experimental.stamp.settings);
    const fromConfig = await grade(quote, { config: { ...EMPTY, experimental: true } });
    assert.deepEqual([fromConfig.pass, fromConfig.stamp.settings], [false, experimental.stamp.settings]);
  });

  it("throws GradeInputError for what chaff grade refuses with exit 2, naming no line", async () => {
    assert.deepEqual(await rejection("x", { citations: [{ address: "1", quote: "q" }] }), ["citations without sources; put the text they quote in sources"]);
    assert.deepEqual(await rejection("x", { language: "x1" }), ['language "x1" cannot be read']);
    const uninstalled = await rejection("x", { language: "xx" });
    assert.match(uninstalled.join(""), /^Cannot load a language package: No package for language xx is installed/u);
    assert.deepEqual(await rejection("x", { config: { ...EMPTY, grade: { penalty: "ten" } } }), [
      'chaff.yaml: grade.penalty must be a number from 0 (found "ten")',
    ]);
    assert.match((await rejection("x", { config: { ...EMPTY, genre: "poetry" } })).join(""), /poetry/u);
    assert.match((await rejection("x", { config: { ...EMPTY, language: "xx" } })).join(""), /^Cannot load a language package: No package for language xx/u);
    assert.match((await rejection("x", { config: "/nowhere/chaff.yaml" })).join(""), /^Could not read \/nowhere\/chaff\.yaml/u);
    const dir = mkdtempSync(join(tmpdir(), "chaff-grade-api-"));
    writeFileSync(join(dir, "chaff.yaml"), "genre: poetry\n");
    const problems = await rejection("x", { config: join(dir, "chaff.yaml") });
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /poetry/u);
  });

  it("is exported as chaffjs/grade", async () => {
    const entry: unknown = await import("chaffjs/grade");
    assert.ok(isGradeEntry(entry));
    assert.deepEqual(await entry.grade("A short note.", { id: "note" }), await grade("A short note.", { id: "note" }));
  });
});
