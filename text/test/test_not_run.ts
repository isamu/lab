import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { notRunAmong } from "../packages/chaff/src/not-run.ts";
import { runConditions } from "../packages/chaff/src/commands/feedback.ts";
import { renderSuppressions, type PerFile } from "../packages/chaff/src/render/suppressions.ts";
import type { Skipped } from "../packages/chaff/src/run.ts";
import { applySuppressions } from "../packages/chaff/src/stet.ts";
import type { Finding } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

// #397: a command that looks up a rule's findings says so when the rule did not run, instead of "none".

const EXPERIMENTAL = "unqualified-superlative";
const STABLE = "max-sentence-length";
const skipped: readonly Skipped[] = [
  { rule: EXPERIMENTAL, why: "まだ試験中のため", offUntilExperimental: true },
  { rule: STABLE, why: "設定で切っているため" },
];

describe("notRunAmong", () => {
  it("keeps only the named rules that were skipped", () => {
    assert.deepEqual(notRunAmong([EXPERIMENTAL, "heading-echo"], skipped), [{ rule: EXPERIMENTAL, why: "まだ試験中のため", needsExperimental: true }]);
    assert.deepEqual(notRunAmong([STABLE], skipped), [{ rule: STABLE, why: "設定で切っているため", needsExperimental: false }]);
  });

  it("is empty when nothing named was skipped", () => {
    assert.deepEqual(notRunAmong([], skipped), []);
    assert.deepEqual(notRunAmong([EXPERIMENTAL], []), []);
  });
});

describe("runConditions", () => {
  it("names the flags that change what is found", () => {
    assert.deepEqual(runConditions(["feedback", "a.md", "--experimental", "--genre", "business/report"], "business/report", false), [
      "--experimental",
      "--genre business/report",
    ]);
    assert.deepEqual(runConditions(["feedback", "a.md"], undefined, false), []);
  });

  it("says chaff.yaml turned experimental rules on when the flag did not", () => {
    assert.deepEqual(runConditions(["feedback", "a.md"], undefined, true), ["experimental: true (chaff.yaml)"]);
    assert.deepEqual(runConditions(["feedback", "a.md", "--experimental"], undefined, true), ["--experimental"]);
  });
});

describe("renderSuppressions: stets on rules that did not run", () => {
  const file = (path: string, notRun: PerFile["notRun"]): PerFile => ({ path, suppressed: [], reasonless: [], notRun });

  it("lists them after 'none', with why and where, and the --experimental hint when it would help", () => {
    const text = renderSuppressions([file("a.md", [{ rule: EXPERIMENTAL, why: "still experimental", needsExperimental: true }])], "en");
    assert.match(
      text,
      /No findings are silenced\.\n\n {2}Rules with a stet that did not run in this check \(not counted\):\n {6}unqualified-superlative +still experimental {3}a\.md\n {2}Experimental rules are counted with --experimental\.\n$/u,
    );
  });

  it("joins the files of one rule, and leaves the hint out when --experimental would not help", () => {
    const text = renderSuppressions(
      [file("a.md", [{ rule: STABLE, why: "off", needsExperimental: false }]), file("b.md", [{ rule: STABLE, why: "off", needsExperimental: false }])],
      "ja",
    );
    assert.match(text, /max-sentence-length +off {3}a\.md, b\.md/u);
    assert.doesNotMatch(text, /--experimental/u);
  });

  it("follows the counts when other stets did silence something", () => {
    const silenced: Finding = { rule: STABLE, severity: "warning", line: 2, column: 1, quote: "", values: {} };
    const { suppressed } = applySuppressions(`<!-- stet: ${STABLE} — r -->\n本文。`, [silenced], []);
    const text = renderSuppressions([{ path: "a.md", suppressed, reasonless: [], notRun: [{ rule: EXPERIMENTAL, why: "x", needsExperimental: true }] }], "en");
    assert.match(text, /Silenced findings: 1/u);
    assert.match(text, /Rules with a stet that did not run in this check/u);
  });

  it("says nothing more when every stet's rule ran", () => {
    assert.equal(renderSuppressions([file("a.md", [])], "en"), "\n  No findings are silenced.\n");
  });
});

describe("chaff feedback and suppressions on an experimental rule (#397)", () => {
  const DOC = "# 試し\n\nこれは最大の理由です。\n\nこれは最高の方法です。\n";
  const STETTED = `# 試し\n\n<!-- stet: ${EXPERIMENTAL} — 理由 -->\nこれは最大の理由です。\n`;

  it("feedback without --experimental says the rule is experimental", async () => {
    const run = await runCli({ "a.md": DOC }, ["feedback", "a.md", "--rule", EXPERIMENTAL, "--line", "3"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /unqualified-superlative did not run in this check \(.+\)\.\nIt is experimental: run again with --experimental\./u);
  });

  it("feedback does not suggest --experimental for a rule chaff.yaml turned off", async () => {
    const run = await runCli(
      { "a.md": DOC, "chaff.yaml": `rules:\n  ${EXPERIMENTAL}: off\n` },
      ["feedback", "a.md", "--rule", EXPERIMENTAL, "--line", "3"],
      "en_US.UTF-8",
    );
    assert.match(run.err, /unqualified-superlative did not run in this check/u);
    assert.doesNotMatch(run.err, /run again with --experimental/u);
  });

  it("feedback with --experimental writes the conditions into the draft", async () => {
    const run = await runCli(
      { "a.md": DOC },
      ["feedback", "a.md", "--rule", EXPERIMENTAL, "--line", "3", "--experimental", "--genre", "business/report"],
      "en_US.UTF-8",
    );
    assert.equal(run.code, 0);
    assert.match(readFileSync(join(run.dir, ".chaff-feedback.md"), "utf8"), /^- Run with: --experimental --genre business\/report$/mu);
  });

  it("suppressions without --experimental lists the stet it could not count", async () => {
    const run = await runCli({ "a.md": STETTED }, ["suppressions", "."], "en_US.UTF-8");
    assert.match(run.out, /No findings are silenced\./u);
    const notRunLine = run.out.split("\n").find((line) => line.trimStart().startsWith("unqualified-superlative"));
    assert.ok(notRunLine?.endsWith("   a.md"), notRunLine ?? "no line for the rule");
    assert.match(run.out, /^ {2}Experimental rules are counted with --experimental\.$/mu);
  });
});
