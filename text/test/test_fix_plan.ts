import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { recommendMode, type ModeInput } from "../packages/chaff/src/fix-plan/mode.ts";
import { phraseHintsOf, rewrittenPathOf, shellPath } from "../packages/chaff/src/fix-plan/plan.ts";
import type { Finding, Lexicon } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";
import { structureTargetsOf } from "../packages/chaff/src/fix-plan/structure-targets.ts";
import type { FeatureId } from "../packages/chaff/src/structure-shape/features.ts";
import type { Placement, StructureScore } from "../packages/chaff/src/structure-shape/score.ts";

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

  it("an outline past human articles on enough measures means a full rewrite, in any genre and with nothing fired", () => {
    const withStructure = (genre: string, fired: readonly string[], score: number): string => {
      const choice = recommendMode({ genre, firedRules: new Set(fired), signalRules: SIGNALS, structure: { score, limit: 3 } });
      return `${choice.mode}/${choice.reason}`;
    };
    assert.equal(withStructure("business/report", [], 3), "full/structure");
    assert.equal(withStructure("business/report", ["max-sentence-length"], 4), "full/structure");
    assert.equal(withStructure("business/report", [], 2), "none/nothing-found");
    assert.equal(withStructure("business/report", ["ai-tell", "closing-cliche"], 2), "bold/signals");
    assert.equal(withStructure("docs/manual", ["ai-generated-composite"], 5), "full/composite");
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
    assert.match(run.out, /\n- `ai-tell`: /u, "each rewrite rule that did not run is still named");
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

  it("reads the outline in the language lint chose, whatever --language says", async () => {
    const run = await runCli({ "en-before.md": fixture("en-before.md") }, ["fix-plan", "en-before.md", "--language", "ja", "--experimental", "--json"]);
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /"unit": "word"/u);
  });

  it("says a missing file is missing", async () => {
    const run = await runCli({}, ["fix-plan", "nowhere.md"]);
    assert.equal(run.code, 1);
    assert.match(run.err, /nowhere\.md/u);
  });

  it("asks for exactly one file", async () => {
    assert.equal((await runCli({}, ["fix-plan"])).code, 1);
    const two = await runCli({ "a.md": "A.\n", "b.md": "B.\n" }, ["fix-plan", "a.md", "b.md"]);
    assert.equal(two.code, 1);
    assert.match(two.err, /fix-plan <file>/u);
  });
});

/** Two headings split into three, bold-label items and an emoji heading: three structure measures past human articles. */
const SPLIT_OUTLINE = [
  "# 勉強会を見直す",
  "",
  "## 課題",
  "",
  "### 人が減った",
  "",
  "来る人が減りました。",
  "",
  "### 話す人が偏った",
  "",
  "同じ人ばかりが話しました。最初の八回のうち六回は、同じ二人の発表でした。",
  "",
  "### 題材が遠かった",
  "",
  "業務と関係のない話が多くなりました。",
  "",
  "## 対策",
  "",
  "### 題材を選ぶ",
  "",
  "題材を業務から選びました。",
  "",
  "### 短く話す",
  "",
  "発表を五分にしました。準備の負担が減り、発表した人は半年で九人になりました。",
  "",
  "### 記録を残す",
  "",
  "話した内容を残しました。",
  "",
  "## 🚀 学んだこと",
  "",
  "- **仕組み**：意志だけでは続きません",
  "- **小ささ**：短い発表なら誰でも話せます",
  "",
].join("\n");

type StructurePlanJson = {
  readonly mode: { readonly mode: string; readonly reason: string };
  readonly structure: { readonly score: number; readonly limit: number };
  readonly targets: readonly { readonly id: string; readonly value: number; readonly limit: number }[];
};

const isStructurePlanJson = (value: unknown): value is StructurePlanJson =>
  typeof value === "object" && value !== null && "structure" in value && "targets" in value && "mode" in value;

describe("fix-plan — a structure target from a placement", () => {
  const placement = (id: FeatureId, value: number | undefined, beyond: boolean): Placement => ({
    feature: { id, value },
    direction: "high",
    pastShare: 95,
    limit: 10,
    median: 4,
    beyond,
  });
  const score = (placements: readonly Placement[]): StructureScore => ({ placements, score: 0, compared: placements.length, articles: 100 });

  it("turns the heading density into headings for this length: now, at most and usually", () => {
    const [target] = structureTargetsOf(score([placement("heading-density", 15, true)]), 2000);
    assert.deepEqual(target?.headings, { now: 30, most: 20, usual: 8 });
    assert.deepEqual([target?.value, target?.limit, target?.median], [15, 10, 4]);
  });

  it("counts the headings the document has, not the rounded density times the length", () => {
    const counted: Placement = { ...placement("heading-density", 10, true), feature: { id: "heading-density", value: 10, count: 1001 } };
    assert.equal(structureTargetsOf(score([counted]), 100000)[0]?.headings?.now, 1001);
  });

  it("lists only the measures past the limit, and gives a budget to the heading density only", () => {
    const targets = structureTargetsOf(
      score([placement("bold-labels", 3, true), placement("bookends", 2, false), placement("emoji-headings", undefined, true)]),
      2000,
    );
    assert.deepEqual(
      targets.map((target) => [target.id, target.headings]),
      [["bold-labels", undefined]],
    );
  });
});

describe("fix-plan — the structure targets", () => {
  it("recommends a full rewrite for an outline past human articles, in a genre that would otherwise be light", async () => {
    const run = await runCli({ "split.md": SPLIT_OUTLINE }, ["fix-plan", "split.md", "--genre", "business/report", "--json"]);
    assert.equal(run.code, 0, run.err);
    const plan: unknown = JSON.parse(run.out);
    assert.ok(isStructurePlanJson(plan));
    assert.equal(`${plan.mode.mode}/${plan.mode.reason}`, "full/structure");
    assert.deepEqual([plan.structure.score, plan.structure.limit], [3, 3]);
    assert.deepEqual(
      plan.targets.map((target) => [target.id, target.value]),
      [
        ["three-subsections", 2],
        ["bold-labels", 2],
        ["emoji-headings", 1],
      ],
    );
  });

  it("writes each target from the human numbers, and when to stop, in the document's language", async () => {
    const run = await runCli({ "split.md": SPLIT_OUTLINE }, ["fix-plan", "split.md", "--genre", "business/report"]);
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /\n## 構成の目標\n\n構成の AI らしさ: 3（/u);
    assert.match(run.out, /\n- 3 つの小見出しに分けた見出しを、中身の数に合わせる: いま 2 か所（人の記事の 9 割は \d+ か所まで）。\n/u);
    assert.match(run.out, /\n- 太字の札で始まる項目 2 個を文に戻す（人の記事の 9 割は \d+ 個まで）。\n/u);
    assert.match(run.out, /構成の AI らしさが 3 未満になったら構成の書き直しを止めます。/u);
  });

  it("says every measure is within the human range when none is past it", async () => {
    const run = await runCli({ "a.md": "# 題\n\n本文です。\n" }, ["fix-plan", "a.md"]);
    assert.match(run.out, /\n## 構成の目標\n\n構成の AI らしさ: 0（[^\n]*\n\n構成の項目は、どれも人の記事の範囲にあります。\n/u);
  });
});
