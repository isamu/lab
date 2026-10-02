import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { packageFor } from "../adapter-load.ts";
import type { Config } from "../config/load.ts";
import { readDocumentFile } from "../files.ts";
import { GENRES } from "../genre.ts";
import { gradeItem, type GradeSetup } from "../grade/grade-item.ts";
import { parseItems, type GradeItem } from "../grade/item.ts";
import { renderCompact, renderSummary } from "../grade/render.ts";
import type { GradeResult } from "../grade/result.ts";
import { gradeSetup } from "../grade/setup.ts";
import { parseRubric, type Rubric } from "../grade/rubric.ts";
import { rulesOf } from "../custom/load.ts";
import { summaryOf } from "../grade/summary.ts";
import { GRADE_TEXT, type GradeText } from "../grade/text.ts";
import { sharedLanguage, type UiLanguage } from "../ui.ts";
import { compareRuns, type Comparison } from "../grade/baseline.ts";
import { BASELINE_TEXT } from "../grade/baseline-text.ts";
import { renderComparison, renderComparisonCompact } from "../grade/render-baseline.ts";
import { chooseBaseline } from "./grade-baseline.ts";

/** Exit codes (spec §29.3). 2 keeps "the grader did not run" apart from "an output is bad" at a CI gate. */
export const GRADE_EXIT = { passed: 0, failed: 1, unreadable: 2 } as const;

const VALUED: ReadonlySet<string> = new Set(["--out", "--genre", "--baseline"]);

const gradeTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.has(all[index - 1] ?? ""));

export type GradeContext = {
  readonly config: Config;
  readonly flag: (argv: readonly string[], name: string) => string | undefined;
  readonly ui: UiLanguage;
};

const readItems = async (path: string, text: GradeText): Promise<readonly GradeItem[] | undefined> => {
  try {
    const parsed = parseItems(await readDocumentFile(path), { isLanguage: (language) => packageFor(language) !== undefined, genres: GENRES });
    if ("items" in parsed) return parsed.items;
    parsed.problems.forEach((problem) => console.error(`${path}: ${text.problem(problem)}`));
  } catch (error) {
    console.error(text.unreadable(path, error instanceof Error ? error.message : String(error)));
  }
  return undefined;
};

/** The `grade:` rubric, or undefined after saying what is wrong with it. `rubric: undefined` is a run with no rubric. */
const readRubric = (config: Config, text: GradeText): { readonly rubric: Rubric | undefined } | undefined => {
  const parsed = parseRubric(config.grade);
  if ("rubric" in parsed) return parsed;
  parsed.problems.forEach((problem) => console.error(`chaff: ${text.rubricProblem(problem)}`));
  return undefined;
};

/** A rule id under grade.rules that chaff does not know. Said once here; each result also lists it as not run. */
const warnUnknownRules = (rubric: Rubric | undefined, config: Config, text: GradeText): void => {
  const known = new Set(rulesOf(config.language ?? "en", config).map((rule) => rule.id));
  Object.keys(rubric?.rules ?? {})
    .filter((id) => !known.has(id))
    .forEach((id) => console.error(`chaff: grade.rules.${id}: ${text.unknownRule}`));
};

const setupFor = async (
  items: readonly GradeItem[],
  rubric: Rubric | undefined,
  argv: readonly string[],
  context: GradeContext,
  text: GradeText,
): Promise<GradeSetup | undefined> => {
  const languages = items.flatMap((item) => (item.language === undefined ? [] : [item.language]));
  const run = { experimental: context.config.experimental || argv.includes("--experimental"), genre: context.flag(argv, "--genre") };
  try {
    return await gradeSetup(context.config, run, languages, rubric);
  } catch (error) {
    console.error(text.cannotLoad(error instanceof Error ? error.message : String(error)));
    return undefined;
  }
};

/** One output after another, in the file's order: the results file lines up with the input. */
const gradeInOrder = (items: readonly GradeItem[], setup: GradeSetup): Promise<GradeResult[]> =>
  items.reduce<Promise<GradeResult[]>>(async (previous, item) => [...(await previous), await gradeItem(item, setup)], Promise.resolve([]));

const writeResults = (path: string | undefined, results: readonly GradeResult[], text: GradeText): void => {
  if (path === undefined) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, results.map((result) => `${JSON.stringify(result)}\n`).join(""), "utf8");
  // 標準エラーに出す。--json の標準出力を JSON のままにする。
  console.error(text.wrote(path, results.length));
};

/** The baseline compared with, when there is one: where it was read from and how this run moved against it. */
type Compared = { readonly path: string; readonly comparison: Comparison } | undefined;

const printSummary = (path: string, results: readonly GradeResult[], argv: readonly string[], compared: Compared, ui: UiLanguage): void => {
  const summary = summaryOf(results);
  const text = GRADE_TEXT[ui];
  const baselineText = BASELINE_TEXT[ui];
  if (argv.includes("--json")) {
    console.log(JSON.stringify(compared === undefined ? summary : { ...summary, baseline: compared.comparison }, null, 2));
    return;
  }
  const compact = argv.includes("--compact");
  console.log(compact ? renderCompact(path, results, summary, text) : renderSummary(path, summary, text));
  if (compared === undefined) return;
  console.log(compact ? renderComparisonCompact(compared.comparison, baselineText) : `\n${renderComparison(compared.path, compared.comparison, baselineText)}`);
};

/** With a baseline, the exit code says whether this run regressed (spec §29.5); without one, whether every output passed. */
const exitCodeOf = (results: readonly GradeResult[], compared: Compared): number => {
  if (compared !== undefined) return compared.comparison.regressions.length === 0 ? GRADE_EXIT.passed : GRADE_EXIT.failed;
  return results.every((result) => result.pass) ? GRADE_EXIT.passed : GRADE_EXIT.failed;
};

/**
 * Grades a JSONL file of model outputs (spec §29.3): each output's findings and rates, facts against its reference and
 * quotations against its sources, then pass or fail. Never calls a model and never rewrites an output.
 */
export const runGrade = async (argv: readonly string[], context: GradeContext): Promise<number> => {
  const host = GRADE_TEXT[context.ui];
  const [path, ...extra] = gradeTargets(argv);
  if (path === undefined || extra.length > 0) {
    console.error(host.usage);
    return GRADE_EXIT.unreadable;
  }
  const rubric = readRubric(context.config, host);
  const items = rubric === undefined ? undefined : await readItems(path, host);
  const setup = items === undefined || rubric === undefined ? undefined : await setupFor(items, rubric.rubric, argv, context, host);
  if (setup === undefined || items === undefined) return GRADE_EXIT.unreadable;
  const baseline = await chooseBaseline(context.flag(argv, "--baseline"), setup.stamp, argv.includes("--allow-stamp-mismatch"), context.ui);
  if (baseline.kind === "stop") return GRADE_EXIT.unreadable;
  warnUnknownRules(setup.rubric, context.config, host);
  const results = await gradeInOrder(items, setup);
  writeResults(context.flag(argv, "--out"), results, host);
  const rubricRules = new Set(Object.keys(setup.rubric?.rules ?? {}));
  const compared = baseline.kind === "compare" ? { path: baseline.path, comparison: compareRuns(baseline.before, results, rubricRules) } : undefined;
  const ui = sharedLanguage(
    results.map((result) => result.language),
    context.ui,
  );
  printSummary(path, results, argv, compared, ui);
  return exitCodeOf(results, compared);
};
