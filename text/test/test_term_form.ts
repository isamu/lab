import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument, type TeamRules } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { configOf } from "../packages/chaff/src/config/load.ts";
import { termProblems } from "../packages/chaff/src/config/term-problems.ts";
import { foldTerm, termVariants } from "../packages/chaff/src/term-form.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const team = (terms: readonly string[]): TeamRules => ({ jargon: [], requiredSections: [], terms });

const runOf = (adapter: LanguageAdapter, source: string, terms: readonly string[]) =>
  runRules(buildDocument("t.md", source, adapter, team(terms)), loadRules(adapter.id), {}, false, "business/report");

const found = (adapter: LanguageAdapter, source: string, terms: readonly string[]): string[] =>
  runOf(adapter, source, terms)
    .findings.filter((finding) => finding.rule === "term-form")
    .map((finding) => `${String(finding.values["matched"])}→${String(finding.values["preferred"])}`);

const written = (text: string, terms: readonly string[]): string[] => termVariants(text, terms).map((variant) => variant.written);

describe("term-form", () => {
  describe("finds a listed term written another way", () => {
    it("case", () => {
      assert.deepEqual(found(en, "# Notes\n\nThe code is on Github and github.\n", ["GitHub"]), ["Github→GitHub", "github→GitHub"]);
    });

    it("full width, in Japanese text", () => {
      assert.deepEqual(found(ja, "# 案内\n\nソースはＧｉｔＨｕｂで公開します。\n", ["GitHub"]), ["ＧｉｔＨｕｂ→GitHub"]);
    });

    it("a space or a hyphen added", () => {
      assert.deepEqual(written("Pages are written in Java Script and Java-Script.", ["JavaScript"]), ["Java Script", "Java-Script"]);
    });

    it("a space dropped from a listed term of two words", () => {
      assert.deepEqual(written("Install claudecode first.", ["Claude Code"]), ["claudecode"]);
    });

    it("half-width katakana, its voiced mark written apart", () => {
      assert.deepEqual(written("ｸﾞﾘｰﾝ社の資料です。", ["グリーン"]), ["ｸﾞﾘｰﾝ"]);
    });

    it("the listed term in Japanese", () => {
      assert.deepEqual(found(ja, "# 案内\n\n株式会社 アオバの担当です。\n", ["株式会社アオバ"]), ["株式会社 アオバ→株式会社アオバ"]);
    });

    it("next to Japanese text", () => {
      assert.deepEqual(written("詳しくはgithubを見てください。", ["GitHub"]), ["github"]);
    });
  });

  describe("leaves alone", () => {
    it("the listed form", () => {
      assert.deepEqual(found(en, "# Notes\n\nThe code is on GitHub.\n", ["GitHub"]), []);
    });

    it("the listed form broken across lines", () => {
      assert.deepEqual(written("Install Claude\nCode first.", ["Claude Code"]), []);
    });

    it("a URL, an address and a path", () => {
      assert.deepEqual(written("See https://github.com/isamu/lab, github.com, docs/github.md and me@github.io.", ["GitHub"]), []);
    });

    it("inline code and code blocks", () => {
      assert.deepEqual(found(en, "# Notes\n\nRun `github login` first.\n\n```\ngithub push\n```\n", ["GitHub"]), []);
    });

    it("a longer word that holds the term", () => {
      assert.deepEqual(written("Every GitHubber knows it. So does a pregithub fan.", ["GitHub"]), []);
    });

    it("another word that only looks alike", () => {
      assert.deepEqual(written("We moved to GitLab.", ["GitHub"]), []);
    });

    it("a place another listed term covers", () => {
      assert.deepEqual(written("Install Claude Code first.", ["Claude", "Claude Code"]), []);
      assert.deepEqual(written("Install claude Code first.", ["Claude", "Claude Code"]), ["claude Code"]);
    });

    it("a form the team listed twice, as either", () => {
      assert.deepEqual(written("Github and GitHub.", ["GitHub", "Github"]), []);
    });
  });

  describe("when nothing is listed", () => {
    it("does not run, and says why", () => {
      const run = runOf(en, "# Notes\n\nThe code is on Github.\n", []);
      assert.equal(run.findings.filter((finding) => finding.rule === "term-form").length, 0);
      const skipped = run.skipped.find((entry) => entry.rule === "term-form");
      assert.match(skipped?.why ?? "", /terms in chaff\.yaml/u);
    });

    it("says why in Japanese", () => {
      const skipped = runOf(ja, "# 案内\n\n公開します。\n", []).skipped.find((entry) => entry.rule === "term-form");
      assert.match(skipped?.why ?? "", /chaff\.yaml の terms/u);
    });
  });

  describe("chaff.yaml", () => {
    it("reads terms, numbers as text", () => {
      const config = configOf({ terms: ["GitHub", 2025, " JavaScript "] }, "/x/chaff.yaml");
      assert.deepEqual(config.terms, ["GitHub", "2025", "JavaScript"]);
      assert.deepEqual(termProblems(config), []);
    });

    it("reports a value that is not a list, and an entry that is not a term", () => {
      assert.equal(termProblems(configOf({ terms: "GitHub" }, "/x/chaff.yaml"), "en").length, 1);
      const [problem, second] = termProblems(configOf({ terms: ["GitHub", { name: "x" }, " - "] }, "/x/chaff.yaml"), "en");
      assert.match(problem ?? "", /cannot read \{"name":"x"\} under terms/u);
      assert.match(second ?? "", /cannot read " - " under terms/u);
    });

    it("reports two terms that differ only in what the rule sets aside, in both languages", () => {
      const config = configOf({ terms: ["GitHub", "Github"] }, "/x/chaff.yaml");
      assert.match(termProblems(config, "en")[0] ?? "", /"GitHub" and "Github" under terms differ only in case/u);
      assert.match(termProblems(config, "ja")[0] ?? "", /「GitHub」と「Github」は字の大小/u);
    });

    it("no terms key, no terms and no problems", () => {
      const config = configOf({}, "/x/chaff.yaml");
      assert.deepEqual(config.terms, []);
      assert.deepEqual(termProblems(config), []);
    });
  });

  it("folds case, width, hyphens and spaces only", () => {
    assert.equal(foldTerm("Ｇｉｔ-Hub"), foldTerm("git hub"));
    assert.notEqual(foldTerm("GitHub"), foldTerm("GitLab"));
    assert.equal(foldTerm(" - "), "");
  });
});
