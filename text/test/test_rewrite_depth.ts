import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { REWRITE_DEPTHS, depthIncludes, depthOfRewrite, readDepth, unknownDepthSentence } from "../packages/chaff/src/rewrite-depth.ts";
import { chosenDepthOf } from "../packages/chaff/src/fix-plan/chosen-depth.ts";
import { recommendMode } from "../packages/chaff/src/fix-plan/mode.ts";
import type { RewriteDepth } from "../packages/chaff/src/rewrite-depth.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { parseCustomRules } from "../packages/chaff/src/custom/parse.ts";
import { customProblemSentence } from "../packages/chaff/src/custom/problems.ts";
import { runCli } from "./cli-run.ts";

// rewrite.depth: how deep a rule's rewrite direction reaches, and how deep chaff fix-plan --depth lets a rewrite go.

const RULES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "chaff", "rules");

describe("rewrite depth — reading a depth as written", () => {
  it("reads each depth chaff knows, and nothing written as no depth", () => {
    REWRITE_DEPTHS.forEach((depth) => assert.deepEqual(readDepth(depth), { depth }));
    assert.deepEqual(readDepth(undefined), { depth: undefined });
    assert.deepEqual(readDepth(null), { depth: undefined });
  });

  it("reports anything else as written: another word, another case, an empty string, a number, a list", () => {
    assert.deepEqual(readDepth("deep"), { unknown: "deep" });
    assert.deepEqual(readDepth("Light"), { unknown: "Light" });
    assert.deepEqual(readDepth(""), { unknown: "" });
    assert.deepEqual(readDepth(2), { unknown: "2" });
    assert.deepEqual(readDepth(["light"]), { unknown: '["light"]' });
  });

  it("finds the depth inside a rewrite block keyed by language, and none in a block without one", () => {
    assert.deepEqual(depthOfRewrite({ depth: "structure", en: { direction: "x" } }), { depth: "structure" });
    assert.deepEqual(depthOfRewrite({ en: { direction: "x" } }), { depth: undefined });
    assert.deepEqual(depthOfRewrite(undefined), { depth: undefined });
    assert.deepEqual(depthOfRewrite("light"), { depth: undefined });
    assert.deepEqual(depthOfRewrite({ depth: "full" }), { unknown: "full" });
  });

  it("a deeper depth includes the shallower, never the other way", () => {
    const pairs = REWRITE_DEPTHS.flatMap((allowed) => REWRITE_DEPTHS.map((needed) => `${allowed}>=${needed}:${String(depthIncludes(allowed, needed))}`));
    assert.deepEqual(pairs, [
      "light>=light:true",
      "light>=structure:false",
      "light>=register:false",
      "structure>=light:true",
      "structure>=structure:true",
      "structure>=register:false",
      "register>=light:true",
      "register>=structure:true",
      "register>=register:true",
    ]);
  });

  it("explains an unknown depth with what was written and every depth, in both languages", () => {
    const ja = unknownDepthSentence("--depth", "deep", "ja");
    const en = unknownDepthSentence("--depth", "deep", "en");
    REWRITE_DEPTHS.forEach((depth) => {
      assert.ok(ja.includes(depth) && en.includes(depth), depth);
    });
    assert.match(ja, /^--depth: deep は書き直しの深さではありません/u);
    assert.match(en, /^--depth: deep is not a rewrite depth/u);
  });
});

describe("rewrite depth — the depth fix-plan goes to", () => {
  it("takes --depth over chaff.yaml, and chaff.yaml when --depth is not given", () => {
    assert.deepEqual(chosenDepthOf("structure", { depth: "light" }, "en"), { chosen: { depth: "structure", from: "flag" } });
    assert.deepEqual(chosenDepthOf(undefined, { depth: "register" }, "en"), { chosen: { depth: "register", from: "config" } });
    assert.deepEqual(chosenDepthOf(undefined, undefined, "en"), { chosen: undefined });
    assert.deepEqual(chosenDepthOf(undefined, { other: 1 }, "en"), { chosen: undefined });
  });

  it("refuses a bad --depth, an empty one, a bad fix_plan.depth and a fix_plan that is not a map", () => {
    const problemOf = (flag: string | undefined, fixPlan: unknown): string => {
      const choice = chosenDepthOf(flag, fixPlan, "en");
      return "problem" in choice ? choice.problem : "";
    };
    assert.match(problemOf("deep", undefined), /^--depth: deep is not/u);
    assert.match(problemOf("", undefined), /^--depth: {2}is not/u);
    assert.match(problemOf(undefined, { depth: "full" }), /^chaff\.yaml fix_plan\.depth: full is not/u);
    assert.match(problemOf(undefined, "light"), /^chaff\.yaml fix_plan: "light" is not/u);
  });

  const modeAt = (fired: readonly string[], genre: string, chosen: RewriteDepth | undefined): string => {
    const choice = recommendMode({ genre, firedRules: new Set(fired), signalRules: new Set(["ai-tell", "closing-cliche"]), chosen });
    return `${choice.mode}/${choice.reason}/${choice.depth ?? "-"}`;
  };

  it("without a depth, recommends as before and names the depth of the way", () => {
    assert.equal(modeAt(["doubled-word"], "business/report", undefined), "light/spots/light");
    assert.equal(modeAt(["ai-tell", "closing-cliche"], "business/report", undefined), "bold/signals/light");
    assert.equal(modeAt(["doubled-word"], "blog/tech", undefined), "full/genre/structure");
    assert.equal(modeAt([], "blog/tech", undefined), "none/nothing-found/-");
  });

  it("at light, keeps Light or Bold and says when chaff would have gone to the structure", () => {
    assert.equal(modeAt(["doubled-word"], "business/report", "light"), "light/spots/light");
    assert.equal(modeAt(["doubled-word"], "blog/tech", "light"), "light/depth-limit/light");
    assert.equal(modeAt(["ai-tell", "closing-cliche", "ai-generated-composite"], "business/report", "light"), "bold/depth-limit/light");
  });

  it("at structure or register, goes exactly that deep; with nothing found there is still nothing to fix", () => {
    assert.equal(modeAt(["doubled-word"], "business/report", "structure"), "full/chosen/structure");
    assert.equal(modeAt(["doubled-word"], "blog/tech", "structure"), "full/genre/structure");
    assert.equal(modeAt(["doubled-word"], "blog/tech", "register"), "register/chosen/register");
    assert.equal(modeAt([], "business/report", "register"), "none/nothing-found/-");
  });
});

describe("rewrite depth — on the rules", () => {
  it("the bundled rules whose direction reorganises the document say structure; the rest read as light", () => {
    const rules = loadRules("en");
    const structure = rules.filter((rule) => rule.guide?.rewriteDepth === "structure").map((rule) => rule.id);
    assert.ok(["ai-structure", "one-sentence-paragraph-run", "paragraph-restatement", "bold-label-list"].every((id) => structure.includes(id)));
    assert.equal(rules.find((rule) => rule.id === "ai-tell")?.guide?.rewriteDepth, "light");
    assert.ok(
      rules.every((rule) => rule.guide?.rewriteDepth !== "register"),
      "no bundled rule converts the style",
    );
  });

  it("refuses to load a bundled rule whose depth is not a depth, and says which values are", () => {
    const dir = mkdtempSync(join(tmpdir(), "chaff-depth-"));
    const source = readFileSync(join(RULES_DIR, "ai-tell.yaml"), "utf8").replace(/^ {2}depth: light$/mu, "  depth: deep");
    writeFileSync(join(dir, "ai-tell.yaml"), source);
    assert.throws(() => loadRules("en", dir), /ai-tell\.yaml: rewrite\.depth: deep は書き直しの深さではありません.*light.*structure.*register/u);
  });

  const context = { builtIn: new Set<string>(), useFor: ["business"], genres: ["business"], baseDir: "." };
  const teamRule = (extra: Record<string, unknown>): Record<string, unknown> => ({
    id: "team-no-tbd",
    type: "words",
    words: ["TBD"],
    name: "TBD left in",
    why: "A reader cannot act on it.",
    how_to_fix: "Write what was decided.",
    example: { before: "Due TBD.", after: "Due 1 May." },
    ...extra,
  });

  it("reads a team rule's rewrite block and its depth", () => {
    const parsed = parseCustomRules([teamRule({ rewrite: { depth: "register", en: { direction: "Say what was decided." } } })], context);
    assert.deepEqual(parsed.problems, []);
    assert.equal(parsed.rules[0]?.guide?.rewriteDepth, "register");
    assert.equal(parsed.rules[0]?.guide?.rewrite["en"]?.direction, "Say what was decided.");
  });

  it("refuses a team rule whose depth is not a depth, and the sentence says which values are", () => {
    const parsed = parseCustomRules([teamRule({ rewrite: { depth: "deep" } })], context);
    assert.deepEqual(parsed.rules, []);
    assert.deepEqual(parsed.problems, [{ kind: "bad-depth", at: "team-no-tbd", written: "deep" }]);
    const [problem] = parsed.problems;
    assert.ok(problem !== undefined);
    assert.match(customProblemSentence(problem, "en"), /custom_rules team-no-tbd: rewrite\.depth: deep is not a rewrite depth.*register/u);
  });

  it("still reads a team rule written before depths, with no rewrite block and no depth", () => {
    const parsed = parseCustomRules([teamRule({})], context);
    assert.deepEqual(parsed.problems, []);
    assert.equal(parsed.rules[0]?.guide?.rewriteDepth, undefined);
  });
});

describe("rewrite depth — on the command line", () => {
  // Five one-sentence paragraphs (one-sentence-paragraph-run, structure) and a doubled word (doubled-word, light).
  const REPORT = [
    "# Room booking",
    "",
    "The new meeting room opens next month.",
    "",
    "Book it through the the facilities page.",
    "",
    "A booking can last two hours.",
    "",
    "The room seats twelve people.",
    "",
    "The projector is new.",
    "",
  ].join("\n");
  const ARGS = ["fix-plan", "report.md", "--experimental", "--genre", "business/report", "--json"];

  type Plan = {
    readonly mode: { readonly mode: string; readonly reason: string; readonly depth: string };
    readonly chosenDepth: { readonly depth: string; readonly from: string } | null;
    readonly rules: readonly { readonly rule: string; readonly depth: string }[];
    readonly deeper: readonly { readonly rule: string; readonly depth: string }[];
    readonly checks: readonly string[];
  };
  const isPlan = (value: unknown): value is Plan => typeof value === "object" && value !== null && "deeper" in value;
  const planWith = async (extra: readonly string[], files: Readonly<Record<string, string>> = {}): Promise<Plan> => {
    const run = await runCli({ "report.md": REPORT, ...files }, [...ARGS, ...extra], "en_US.UTF-8");
    assert.equal(run.code, 0, run.err);
    const parsed: unknown = JSON.parse(run.out);
    assert.ok(isPlan(parsed));
    return parsed;
  };

  it("without a depth, plans every rule that fired, each with its depth", async () => {
    const plan = await planWith([]);
    assert.deepEqual(
      plan.rules.map((rule) => `${rule.rule}:${rule.depth}`),
      ["one-sentence-paragraph-run:structure", "doubled-word:light"],
    );
    assert.deepEqual(plan.deeper, []);
  });

  it("at light, sets the structure rule apart and compares as before", async () => {
    const plan = await planWith(["--depth", "light"]);
    assert.deepEqual(
      plan.rules.map((rule) => rule.rule),
      ["doubled-word"],
    );
    assert.deepEqual(
      plan.deeper.map((rule) => `${rule.rule}:${rule.depth}`),
      ["one-sentence-paragraph-run:structure"],
    );
    assert.deepEqual(plan.chosenDepth, { depth: "light", from: "flag" });
    assert.ok(plan.checks.every((check) => !check.includes("--distinct")));
  });

  it("at structure, from chaff.yaml, plans both and compares a rewrite whose headings may move", async () => {
    const plan = await planWith([], { "chaff.yaml": "fix_plan:\n  depth: structure\n" });
    assert.equal(`${plan.mode.mode}/${plan.mode.depth}`, "full/structure");
    assert.deepEqual(plan.chosenDepth, { depth: "structure", from: "config" });
    assert.equal(plan.rules.length, 2);
    assert.ok(plan.checks.some((check) => check.includes("--distinct --allow-dropped heading --allow-added heading")));
  });

  it("names the rules a depth leaves out in the Markdown plan too", async () => {
    const run = await runCli({ "report.md": REPORT }, ARGS.filter((arg) => arg !== "--json").concat("--depth", "light"), "en_US.UTF-8");
    assert.match(run.out, /\n## Rules deeper than the depth set\n/u);
    assert.match(run.out, /\n- `one-sentence-paragraph-run` Run of one-sentence paragraphs: depth structure, 1 spot\n/u);
  });

  it("stops on a depth it does not know, from the command line or from chaff.yaml, and says which depths there are", async () => {
    const flag = await runCli({ "report.md": REPORT }, [...ARGS, "--depth", "deep"], "en_US.UTF-8");
    assert.equal(flag.code, 1);
    assert.match(flag.err, /--depth: deep is not a rewrite depth\. A depth is one of light .* structure .* register/u);
    const config = await runCli({ "report.md": REPORT, "chaff.yaml": "fix_plan:\n  depth: full\n" }, ARGS, "ja_JP.UTF-8");
    assert.equal(config.code, 1);
    assert.match(config.err, /chaff\.yaml fix_plan\.depth: full は書き直しの深さではありません/u);
  });

  it("with every finding deeper than the depth, says there is nothing to fix at that depth rather than recommending a light pass", async () => {
    const onlyParagraphs = REPORT.replace("the the", "the");
    const run = await runCli({ "report.md": onlyParagraphs }, [...ARGS, "--depth", "light"], "en_US.UTF-8");
    const parsed: unknown = JSON.parse(run.out);
    assert.ok(isPlan(parsed));
    assert.equal(`${parsed.mode.mode}/${parsed.mode.reason}`, "none/all-deeper");
    assert.deepEqual(parsed.rules, []);
    assert.equal(parsed.deeper.length, 1);
  });

  it("reads a file name written after --depth as the depth, and says so, rather than losing the file", async () => {
    const run = await runCli({ "report.md": REPORT }, ["fix-plan", "--depth", "report.md"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /--depth: report\.md is not a rewrite depth/u);
  });

  it("shows a rule's depth in rules --json and in explain", async () => {
    const json = await runCli({}, ["rules", "--json"], "en_US.UTF-8");
    const parsed: unknown = JSON.parse(json.out);
    assert.ok(typeof parsed === "object" && parsed !== null && "rules" in parsed && "rewrite_depths" in parsed && Array.isArray(parsed.rules));
    const rules: unknown[] = parsed.rules;
    const depthOf = (id: string): unknown => {
      const rule = rules.find((entry) => typeof entry === "object" && entry !== null && "id" in entry && entry.id === id);
      return typeof rule === "object" && rule !== null && "rewrite_depth" in rule ? rule.rewrite_depth : undefined;
    };
    assert.equal(depthOf("one-sentence-paragraph-run"), "structure");
    assert.equal(depthOf("doubled-word"), "light");
    const explain = await runCli({}, ["explain", "one-sentence-paragraph-run"], "en_US.UTF-8");
    assert.match(explain.out, /Rewrite depth: structure \(sections, headings and paragraphs are reorganised\)/u);
  });
});
