import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { recommendMode, type ModeInput } from "../packages/chaff/src/fix-plan/mode.ts";
import { phraseHintsOf, rewrittenPathOf, shellPath } from "../packages/chaff/src/fix-plan/plan.ts";
import type { Finding, Lexicon } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

const FIXTURES = join(import.meta.dirname, "fixtures", "fix-plan");
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), "utf8");

const SIGNALS: ReadonlySet<string> = new Set(["ai-tell", "contrast-framing", "closing-cliche", "bold-density"]);
const modeOf = (genre: string, fired: readonly string[]): string => {
  const input: ModeInput = { genre, firedRules: new Set(fired), signalRules: SIGNALS };
  const choice = recommendMode(input);
  return `${choice.mode}/${choice.reason}`;
};

describe("fix-plan — the recommended mode", () => {
  it("nothing found is nothing to fix, in any genre", () => {
    assert.equal(modeOf("blog/tech", []), "none/nothing-found");
    assert.equal(modeOf("docs/manual", []), "none/nothing-found");
  });

  it("ai-generated-composite means a full rewrite, whatever the genre", () => {
    assert.equal(modeOf("docs/manual", ["ai-generated-composite", "ai-tell"]), "full/composite");
    assert.equal(modeOf("blog/tech", ["ai-generated-composite"]), "full/composite");
  });

  it("a blog post or an essay is rewritten in full; other literature is not", () => {
    assert.equal(modeOf("blog/tech", ["max-sentence-length"]), "full/genre");
    assert.equal(modeOf("blog/essay", ["ai-tell"]), "full/genre");
    assert.equal(modeOf("literature/essay", ["ai-tell"]), "full/genre");
    assert.equal(modeOf("literature/fiction", ["ai-tell"]), "light/spots");
  });

  it("two document-wide signals mean bold; one, or only spot rules, mean light", () => {
    assert.equal(modeOf("business/report", ["ai-tell", "closing-cliche"]), "bold/signals");
    assert.equal(modeOf("business/report", ["ai-tell", "max-sentence-length"]), "light/spots");
    assert.equal(modeOf("business/report", ["max-sentence-length", "doubled-word"]), "light/spots");
  });
});

describe("fix-plan — where the rewrite goes, and how a shell reads it", () => {
  it("puts .rewritten before the extension, beside the original", () => {
    assert.equal(rewrittenPathOf("docs/article.md"), "docs/article.rewritten.md");
    assert.equal(rewrittenPathOf("article.txt"), "article.rewritten.txt");
    assert.equal(rewrittenPathOf("README"), "README.rewritten");
    assert.equal(rewrittenPathOf(".notes"), ".notes.rewritten");
    assert.equal(rewrittenPathOf("v1.2/notes"), "v1.2/notes.rewritten");
  });

  it("quotes a path only when it holds a character a shell would read", () => {
    assert.equal(shellPath("docs/article.md"), "docs/article.md");
    assert.equal(shellPath("my notes.md"), "'my notes.md'");
    assert.equal(shellPath("下書き.md"), "'下書き.md'");
    assert.equal(shellPath("it's.md"), "'it'\\''s.md'");
  });
});

describe("fix-plan — a phrase's own hint", () => {
  const phrases: Lexicon = [
    { pattern: "delve into", rewrite: "look at, or explain" },
    { pattern: "tapestry" },
    { pattern: "A testament to", rewrite: "shows" },
  ];
  const aiTell = (word: string): Finding => ({ rule: "ai-tell", severity: "info", line: 1, column: 1, quote: "", values: { word } });

  it("gives the hint of each named phrase that has one, matching the lower-cased name the finding carries", () => {
    assert.deepEqual(phraseHintsOf(aiTell("delve into, tapestry, a testament to"), phrases, "en"), [
      { phrase: "delve into", rewrite: "look at, or explain" },
      { phrase: "A testament to", rewrite: "shows" },
    ]);
  });

  it("gives nothing for a phrase without a hint, one not named, or a finding that names none", () => {
    assert.deepEqual(phraseHintsOf(aiTell("tapestry"), phrases, "en"), []);
    assert.deepEqual(phraseHintsOf(aiTell("deep dive"), phrases, "en"), []);
    assert.deepEqual(phraseHintsOf(aiTell(""), phrases, "en"), []);
    assert.deepEqual(phraseHintsOf({ ...aiTell(""), values: {} }, phrases, "en"), []);
  });

  it("splits a Japanese list on 、, so a phrase is matched whole", () => {
    const ja: Lexicon = [
      { pattern: "時間を溶かす", rewrite: "時間がかかった（何に、どれだけ）" },
      { pattern: "溶かす", rewrite: "x" },
    ];
    assert.deepEqual(phraseHintsOf(aiTell("現代社会において、時間を溶かす"), ja, "ja"), [
      { phrase: "時間を溶かす", rewrite: "時間がかかった（何に、どれだけ）" },
    ]);
  });
});

type PlanJson = {
  readonly language: string;
  readonly mode: { readonly mode: string; readonly reason: string; readonly why: string };
  readonly signals: readonly { readonly rule: string }[];
  readonly rules: readonly {
    readonly rule: string;
    readonly direction: string;
    readonly pair?: { readonly before: string; readonly after: string };
    readonly hints: readonly { readonly phrase: string }[];
    readonly spots: readonly { readonly line: number }[];
  }[];
  readonly notRun: readonly { readonly rule: string }[];
  readonly constraints: readonly string[];
  readonly checks: readonly string[];
};

const isPlanJson = (value: unknown): value is PlanJson => typeof value === "object" && value !== null && "rules" in value && "mode" in value;

const planOf = async (name: string, extra: readonly string[] = ["--experimental"]): Promise<PlanJson> => {
  const run = await runCli({ [name]: fixture(name) }, ["fix-plan", name, "--json", ...extra]);
  assert.equal(run.code, 0, run.err);
  const parsed: unknown = JSON.parse(run.out);
  assert.ok(isPlanJson(parsed));
  return parsed;
};

describe("fix-plan — the plan for a document", () => {
  it("groups an English draft's findings by rule, with each rule's direction, a pair and the phrase hints", async () => {
    const plan = await planOf("en-before.md");
    assert.equal(plan.language, "en");
    assert.equal(`${plan.mode.mode}/${plan.mode.reason}`, "full/composite");
    assert.equal(plan.signals[0]?.rule, "ai-generated-composite");
    const aiTell = plan.rules.find((rule) => rule.rule === "ai-tell");
    assert.ok(aiTell?.direction.startsWith("Replace the stock phrase"));
    assert.ok(aiTell?.pair !== undefined);
    assert.ok(aiTell?.hints.some((hint) => hint.phrase === "delve into"));
    assert.ok(!plan.rules.some((rule) => rule.rule === "ai-generated-composite"), "the composite is a signal, not a spot");
    assert.equal(plan.constraints.length, 4);
  });

  it("lists every finding lint reports, once: each as a spot, the composite as a signal", async () => {
    const plan = await planOf("en-before.md");
    const lint = await runCli({ "en-before.md": fixture("en-before.md") }, ["en-before.md", "--experimental", "--compact"]);
    const reported = lint.out.split("\n").filter((line) => /^ {2}\d+:\d+ /u.test(line)).length;
    const spots = plan.rules.reduce((sum, rule) => sum + rule.spots.length, 0);
    const composite = plan.signals.some((signal) => signal.rule === "ai-generated-composite") ? 1 : 0;
    assert.equal(spots + composite, reported);
  });

  it("writes a Japanese draft's plan in Japanese, with the lexicon's own hints", async () => {
    const plan = await planOf("ja-before.md");
    assert.equal(plan.language, "ja");
    assert.match(plan.constraints[0] ?? "", /事実/u);
    const aiTell = plan.rules.find((rule) => rule.rule === "ai-tell");
    assert.deepEqual(
      aiTell?.hints.map((hint) => hint.phrase).filter((phrase) => ["時間を溶かす", "静かに壊れる"].includes(phrase)),
      ["時間を溶かす", "静かに壊れる"],
    );
  });

  it("recommends by genre and by what fires: full for a blog post, bold or light for a report", async () => {
    assert.equal((await planOf("ja-before.md")).mode.reason, "genre");
    // As a report, the English draft keeps two document-wide signals (ai-tell, padded-intro); the Japanese one keeps only ai-tell.
    const report = await planOf("en-before.md", ["--experimental", "--genre", "business/report"]);
    assert.equal(`${report.mode.mode}/${report.mode.reason}`, "bold/signals");
    const japaneseReport = await planOf("ja-before.md", ["--experimental", "--genre", "business/report"]);
    assert.equal(`${japaneseReport.mode.mode}/${japaneseReport.mode.reason}`, "light/spots");
    assert.ok(
      report.checks.every((check) => !check.includes("--distinct")),
      "only a full rewrite compares as sets",
    );
    assert.ok(report.checks[0]?.endsWith("--experimental --genre business/report"));
  });

  it("gives the checks to run on the rewrite, beside the original", async () => {
    const plan = await planOf("en-before.md");
    assert.deepEqual(plan.checks, [
      "npx chaffjs en-before.rewritten.md --experimental",
      "npx chaffjs compare en-before.md en-before.rewritten.md --distinct --allow-dropped heading --allow-added heading",
      "npx chaffjs outline en-before.md en-before.rewritten.md",
    ]);
  });

  it("finds nothing to fix in the rewrites of the worked example", async () => {
    const english = await planOf("en-after.md");
    const japanese = await planOf("ja-after.md");
    assert.deepEqual([english.mode.mode, english.rules.length, japanese.mode.mode, japanese.rules.length], ["none", 0, "none", 0]);
  });

  it("says the experimental rules did not run, rather than reading their silence as clean", async () => {
    const run = await runCli({ "en-before.md": fixture("en-before.md") }, ["fix-plan", "en-before.md"]);
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /## Rules that did not run\n\nThe experimental rules did not run/u);
    assert.doesNotMatch(run.out, /`ai-tell`/u);
  });

  it("does not list a rule written for another language as one that did not run", async () => {
    const plan = await planOf("en-before.md");
    assert.ok(!plan.notRun.some((skipped) => skipped.rule === "colon-lead-in"));
  });

  it("lists only the rewrite and signal rules that did not run, not every rule lint skipped", async () => {
    const plan = await planOf("en-before.md");
    // empty-conclusion reads meaning, so lint skips it; it has no rewrite block and is no signal.
    assert.ok(!plan.notRun.some((skipped) => skipped.rule === "empty-conclusion"));
  });

  it("prints the same plan every time", async () => {
    const first = await runCli({ "ja-before.md": fixture("ja-before.md") }, ["fix-plan", "ja-before.md", "--experimental"]);
    const second = await runCli({ "ja-before.md": fixture("ja-before.md") }, ["fix-plan", "ja-before.md", "--experimental"]);
    assert.equal(first.out, second.out);
    assert.match(first.out, /^# 直す計画: ja-before\.md\n/u);
    assert.match(first.out, /\n## 勧める直し方: 全面書き直し（Full）\n/u);
  });

  it("asks for exactly one file", async () => {
    assert.equal((await runCli({}, ["fix-plan"])).code, 1);
    const two = await runCli({ "a.md": "A.\n", "b.md": "B.\n" }, ["fix-plan", "a.md", "b.md"]);
    assert.equal(two.code, 1);
    assert.match(two.err, /fix-plan <file>/u);
  });
});
