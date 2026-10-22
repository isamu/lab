import { existsSync } from "node:fs";
import { outlineOf } from "../outline/shape.ts";
import { structureOf } from "../structure-shape/of-document.ts";
import { buildFixPlan, type AiScoreSummary, type SincePlan } from "../fix-plan/plan.ts";
import { renderFixPlanJson, renderFixPlanMarkdown } from "../fix-plan/render.ts";
import { FIX_PLAN_TEXT } from "../fix-plan/text.ts";
import { chosenDepthOf } from "../fix-plan/chosen-depth.ts";
import { allSignRules, runAllSigns, withAllSigns, type LintResult } from "../fix-plan/all-signs.ts";
import { risenRules } from "../fix-plan/risen.ts";
import { aiScoreOfDocument } from "../ai-score/of-document.ts";
import { shownSignsOf, type AiScore } from "../ai-score/score.ts";
import type { Checked } from "./feedback.ts";
import { readDocument } from "./read-document.ts";
import type { TreeContext } from "./tree.ts";
import { genreWasSet, reportedGuide, type ReportedGuide } from "../genre-guide/report.ts";
import { showsGuide } from "../cli-args.ts";
import type { Config } from "../config/load.ts";

/** Options whose value is the next argument. That value is not a file. */
const VALUED: ReadonlySet<string> = new Set(["--language", "--genre", "--depth", "--before"]);

const ALL_SIGNS_FLAG = "--all-ai-signs";

/** --depth's value: undefined when not given, empty when given with nothing after it (which is then reported). */
const depthFlag = (argv: readonly string[], context: FixPlanContext): string | undefined =>
  argv.includes("--depth") ? (context.flag(argv, "--depth") ?? "") : undefined;

export const fixPlanTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.has(all[index - 1] ?? ""));

export type FixPlanContext = TreeContext & {
  /** The file's findings as lint finds them, shelved ones included. */
  readonly check: (path: string) => Promise<Omit<Checked, "conditions">>;
};

/** The genre's guide, the plan's first section; none when the genre was not set or the guide is off. */
const guideOf = (checked: Omit<Checked, "conditions">, config: Config, argv: readonly string[]): ReportedGuide | undefined =>
  genreWasSet(checked.genreFrom) && showsGuide(argv) ? reportedGuide(config, checked.genre, checked.language, checked.rules) : undefined;

/** One file as the plan reads it: what lint found, the findings the plan is built from, and the score with --all-ai-signs. */
type PlanRead = { readonly checked: Omit<Checked, "conditions">; readonly found: LintResult; readonly allSigns: AllSigns | undefined };

type AllSigns = { readonly aiScore: AiScoreSummary; readonly ruleIds: ReadonlySet<string> };

const summaryOf = (score: AiScore): AiScoreSummary => ({
  level: score.level ?? null,
  notScored: score.notScored?.reason ?? null,
  signs: score.signs,
  compared: score.compared,
  shown: shownSignsOf(score),
});

/**
 * With --all-ai-signs, every AI-likeness rule's findings take the place of lint's own for them, and the plan carries the
 * AI-likeness score. The document is read with part-of-speech tags, as ai-score reads it.
 */
const readForPlan = async (path: string, argv: readonly string[], context: FixPlanContext): Promise<PlanRead | undefined> => {
  const checked = await context.check(path);
  if (!argv.includes(ALL_SIGNS_FLAG)) return { checked, found: checked, allSigns: undefined };
  const prose = await readDocument(path, ["fix-plan", "--language", checked.language, ...argv.slice(1)], context, true);
  if (prose === undefined) return undefined;
  const signs = runAllSigns(prose.doc, checked.rules, checked.genre);
  const ruleIds = new Set(allSignRules(checked.rules, checked.language).map((rule) => rule.id));
  return {
    checked,
    found: withAllSigns(checked, signs, ruleIds),
    allSigns: { aiScore: summaryOf(aiScoreOfDocument(prose.doc, checked.rules, checked.genre)), ruleIds },
  };
};

/** The original given with --before, read the same way: the rules whose findings the rewrite raised, and its score. */
const sinceOf = async (path: string, after: PlanRead, argv: readonly string[], context: FixPlanContext): Promise<SincePlan | undefined> => {
  const before = await readForPlan(path, argv, context);
  return before === undefined ? undefined : { path, risen: risenRules(before.found.findings, after.found.findings), aiScore: before.allSigns?.aiScore ?? null };
};

/** --before's file, read; a problem to report when it is missing. */
const sinceFor = async (
  argv: readonly string[],
  after: PlanRead,
  context: FixPlanContext,
): Promise<{ readonly since: SincePlan | undefined } | { readonly problem: string | undefined }> => {
  const path = context.flag(argv, "--before");
  if (path === undefined) return { since: undefined };
  if (!existsSync(path)) return { problem: FIX_PLAN_TEXT[context.ui ?? "ja"].notFound(path) };
  const since = await sinceOf(path, after, argv, context);
  return since === undefined ? { problem: undefined } : { since };
};

/**
 * An instruction document for whoever rewrites the file: the findings grouped by rule, each rule's rewrite direction,
 * the document-level signals, the structure targets from human articles, a recommended mode and the checks to run after. Deterministic; sends nothing anywhere.
 */
export const runFixPlan = async (targets: readonly string[], argv: readonly string[], context: FixPlanContext): Promise<number> => {
  // Checked first: a file name written after --depth by mistake is reported as the depth it was read as.
  const depth = chosenDepthOf(depthFlag(argv, context), context.config.fixPlan, context.ui ?? "ja");
  if ("problem" in depth) {
    console.error(`chaff: ${depth.problem}`);
    return 1;
  }
  const [path] = targets;
  if (path === undefined || targets.length > 1) {
    console.error(FIX_PLAN_TEXT[context.ui ?? "ja"].usage);
    return 1;
  }
  if (!existsSync(path)) {
    console.error(FIX_PLAN_TEXT[context.ui ?? "ja"].notFound(path));
    return 1;
  }
  const read = await readForPlan(path, argv, context);
  if (read === undefined) return 1;
  const since = await sinceFor(argv, read, context);
  if ("problem" in since) {
    if (since.problem !== undefined) console.error(since.problem);
    return 1;
  }
  const { checked } = read;
  // The outline is read in the language lint chose, so the plan's findings and its outline describe one reading.
  const prose = await readDocument(path, ["fix-plan", "--language", checked.language, ...argv.slice(1)], context, false);
  if (prose === undefined) return 1;
  const plan = buildFixPlan({
    path,
    language: checked.language,
    genre: checked.genre,
    experimental: context.config.experimental || argv.includes("--experimental"),
    genreFlag: context.flag(argv, "--genre"),
    findings: read.found.findings,
    rules: checked.rules,
    skipped: read.found.skipped,
    outline: outlineOf(prose.doc),
    structure: structureOf(prose.doc),
    phrases: prose.doc.lexicons["ai-tell"] ?? [],
    chosenDepth: depth.chosen,
    guide: guideOf(checked, context.config, argv),
    allSigns: read.allSigns,
    since: since.since,
  });
  console.log(argv.includes("--json") ? renderFixPlanJson(plan) : renderFixPlanMarkdown(plan));
  return 0;
};
