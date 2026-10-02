import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { GENRES } from "../packages/chaff/src/genre.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { REASONS } from "../packages/chaff/src/reasons.ts";
import { runRules, type RunResult } from "../packages/chaff/src/run.ts";
import { renderSarif } from "../packages/chaff/src/render/sarif.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { runCli } from "./cli-run.ts";

// #498: a rule the genre's use_for leaves out is listed under "did not run", like one the genre's preset turns off.

const JA_DOC = "# 使い方\n\n## 入れる\n\nこのツールは、文書を機械で確かめます。設定は要りません。\n";
const EN_DOC = "# Usage\n\n## Install\n\nThis tool checks a document by machine. It needs no settings.\n";

const runJa = (genre: string, experimental = false): RunResult => runRules(buildDocument("t.md", JA_DOC, ja), loadRules("ja"), {}, experimental, genre);
const runEn = (genre: string): RunResult => runRules(buildDocument("t.md", EN_DOC, en), loadRules("en"), {}, false, genre);

const suits = (rule: RuleDefinition, genre: string): boolean => rule.use_for.some((target) => genre.startsWith(target));

const whyOf = (result: RunResult, rule: string): string | undefined => result.skipped.find((entry) => entry.rule === rule)?.why;

describe("rules use_for keeps out of the genre", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("are listed with the genre as the reason", () => {
    const result = runJa("technical/spec");
    assert.equal(whyOf(result, "ai-tell"), REASONS.ja.presetOff("technical/spec"));
    assert.equal(whyOf(result, "section-length-uniformity"), REASONS.ja.presetOff("technical/spec"));
    assert.equal(whyOf(runEn("technical/spec"), "ai-tell"), REASONS.en.presetOff("technical/spec"));
  });

  it("the AI-shape rules run in technical/readme as experimental rules", () => {
    const shapes = ["ai-tell", "section-length-uniformity", "rule-of-three", "bold-label-list", "ai-generated-composite"];
    shapes.forEach((rule) => assert.equal(whyOf(runJa("technical/readme"), rule), REASONS.ja.experimental, rule));
    shapes.forEach((rule) => assert.equal(whyOf(runJa("technical/readme", true), rule), undefined, rule));
  });

  it("an experimental rule out of the genre does not suggest --experimental, which would not run it", () => {
    const entry = runJa("blog/tech").skipped.find((skipped) => skipped.rule === "undefined-acronym");
    assert.deepEqual(entry, { rule: "undefined-acronym", why: REASONS.ja.presetOff("blog/tech") });
    assert.equal(whyOf(runJa("blog/tech", true), "undefined-acronym"), REASONS.ja.presetOff("blog/tech"));
  });

  it("a rule for another language says so first: no genre would run it on this document", () => {
    assert.equal(whyOf(runJa("technical/readme"), "sentence-initial-conjunction-run"), REASONS.ja.otherLanguage("ja"));
  });

  it("a rule the genre covers is not listed for the genre", () => {
    assert.notEqual(whyOf(runJa("blog/tech"), "ai-tell"), REASONS.ja.presetOff("blog/tech"));
    assert.equal(whyOf(runJa("blog/tech", true), "ai-tell"), undefined);
  });

  it("in every genre, every rule either ran or is listed, each once", () => {
    const rules = loadRules("ja");
    GENRES.forEach((genre) => {
      const result = runJa(genre, true);
      const listed = result.skipped.map((entry) => entry.rule);
      assert.equal(new Set(listed).size, listed.length, genre);
      const silent = rules.filter((rule) => rule.from.length === 0 && !listed.includes(rule.id));
      assert.deepEqual(
        silent.filter((rule) => !suits(rule, genre)).map((rule) => rule.id),
        [],
        genre,
      );
    });
  });
});

describe("the rules that did not run reach SARIF and feedback", () => {
  it("SARIF carries one notification per rule and reason, with the files it holds for", () => {
    const sarif: unknown = JSON.parse(
      renderSarif([], "0.0.0", [
        { path: "a.md", rule: "ai-tell", why: "the technical/spec genre does not check it" },
        { path: "b.md", rule: "ai-tell", why: "the technical/spec genre does not check it" },
        { path: "b.md", rule: "rule-of-three", why: "still experimental" },
      ]),
    );
    const text = JSON.stringify(sarif);
    assert.match(text, /"message":\{"text":"ai-tell: the technical\/spec genre does not check it"\},"associatedRule":\{"id":"chaff\/ai-tell"\}/u);
    assert.match(text, /"artifactLocation":\{"uri":"a.md"\}\}\},\{"physicalLocation":\{"artifactLocation":\{"uri":"b.md"\}/u);
    assert.equal(text.match(/"associatedRule"/gu)?.length, 2);
  });

  it("chaff --sarif lists the rules the genre left out", async () => {
    const run = await runCli({ "README.md": EN_DOC }, ["README.md", "--genre", "technical/spec", "--sarif", "out.sarif"], "en_US.UTF-8");
    const sarif = readFileSync(join(run.dir, "out.sarif"), "utf8");
    assert.match(sarif, /"text": "ai-tell: the technical\/spec genre does not check it"/u);
  });

  it("chaff feedback says why the asked-for rule did not run", async () => {
    const run = await runCli({ "README.md": EN_DOC }, ["feedback", "README.md", "--rule", "ai-tell", "--genre", "technical/spec"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /ai-tell did not run in this check \(the technical\/spec genre does not check it\)\./u);
    assert.doesNotMatch(run.err, /run again with --experimental/u);
  });
});
