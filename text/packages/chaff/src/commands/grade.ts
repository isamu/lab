import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { packageFor } from "../adapter-load.ts";
import type { Config } from "../config/load.ts";
import { readDocumentFile } from "../files.ts";
import { GENRES } from "../genre.ts";
import { gradeItem, type GradeSetup } from "../grade/grade-item.ts";
import { DEFAULT_VARIANT_FIELD, ITEM_FIELDS, parseItems, type GradeItem, type VariantField } from "../grade/item.ts";
import { renderMarkdown } from "../grade/render-markdown.ts";
import { renderVariants, renderVariantsCompact } from "../grade/render-variants.ts";
import { variantsOfRun, type VariantComparison } from "../grade/variants.ts";
import { VARIANT_TEXT } from "../grade/variants-text.ts";
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

const VALUED: ReadonlySet<string> = new Set(["--out", "--genre", "--baseline", "--format", "--variant-key"]);

const FORMATS = ["text", "json", "markdown"] as const;

type Format = (typeof FORMATS)[number];

const isFormat = (value: string): value is Format => FORMATS.some((format) => format === value);

/** --format, with --json as its short form. Undefined for a format chaff does not write. */
const formatOf = (argv: readonly string[], context: GradeContext): Format | undefined => {
  const written = context.flag(argv, "--format") ?? (argv.includes("--json") ? "json" : "text");
  return isFormat(written) ? written : undefined;
};

/** The field naming each output's variant. Given on the command line, every line must have it; a field an item already uses cannot be one. */
const variantFieldOf = (argv: readonly string[], context: GradeContext): VariantField | undefined => {
  const key = context.flag(argv, "--variant-key");
  if (key === undefined) return DEFAULT_VARIANT_FIELD;
  return key === "" || ITEM_FIELDS.includes(key) ? undefined : { key, required: true };
};

const gradeTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.has(all[index - 1] ?? ""));

export type GradeContext = {
  readonly config: Config;
  readonly flag: (argv: readonly string[], name: string) => string | undefined;
  readonly ui: UiLanguage;
};

const readItems = async (path: string, variantField: VariantField, text: GradeText): Promise<readonly GradeItem[] | undefined> => {
  try {
    const vocabulary = { isLanguage: (language: string) => packageFor(language) !== undefined, genres: GENRES };
    const parsed = parseItems(await readDocumentFile(path), vocabulary, variantField);
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

/** What the summary is printed with: the format, the comparisons made, and the language of the outputs. */
type Printing = { readonly format: Format; readonly compact: boolean; readonly ui: UiLanguage };

const printJson = (results: readonly GradeResult[], variants: VariantComparison | undefined, compared: Compared): void => {
  const summary = summaryOf(results);
  const withVariants = variants === undefined ? summary : { ...summary, variants };
  console.log(JSON.stringify(compared === undefined ? withVariants : { ...withVariants, baseline: compared.comparison }, null, 2));
};

const printText = (path: string, results: readonly GradeResult[], variants: VariantComparison | undefined, compared: Compared, printing: Printing): void => {
  const summary = summaryOf(results);
  const { compact, ui } = printing;
  console.log(compact ? renderCompact(path, results, summary, GRADE_TEXT[ui]) : renderSummary(path, summary, GRADE_TEXT[ui]));
  if (variants !== undefined) console.log(compact ? renderVariantsCompact(variants, VARIANT_TEXT[ui]) : `\n${renderVariants(variants, VARIANT_TEXT[ui])}`);
  if (compared === undefined) return;
  const baselineText = BASELINE_TEXT[ui];
  console.log(compact ? renderComparisonCompact(compared.comparison, baselineText) : `\n${renderComparison(compared.path, compared.comparison, baselineText)}`);
};

const printSummary = (path: string, results: readonly GradeResult[], compared: Compared, printing: Printing): void => {
  const variants = variantsOfRun(results);
  if (printing.format === "json") printJson(results, variants, compared);
  else if (printing.format === "markdown") {
    const texts = { grade: GRADE_TEXT[printing.ui], variants: VARIANT_TEXT[printing.ui] };
    console.log(renderMarkdown(path, summaryOf(results), { variants, baseline: compared?.comparison }, texts));
  } else printText(path, results, variants, compared, printing);
};

type RunOptions = { readonly path: string; readonly format: Format; readonly variantField: VariantField };

/** The file to grade and how to read and print it, or undefined after printing the usage. */
const runOptionsOf = (argv: readonly string[], context: GradeContext): RunOptions | undefined => {
  const [path, ...extra] = gradeTargets(argv);
  const format = formatOf(argv, context);
  const variantField = variantFieldOf(argv, context);
  if (path !== undefined && extra.length === 0 && format !== undefined && variantField !== undefined) return { path, format, variantField };
  console.error(GRADE_TEXT[context.ui].usage);
  return undefined;
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
  const options = runOptionsOf(argv, context);
  if (options === undefined) return GRADE_EXIT.unreadable;
  const { path } = options;
  const rubric = readRubric(context.config, host);
  const items = rubric === undefined ? undefined : await readItems(path, options.variantField, host);
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
  printSummary(path, results, compared, { format: options.format, compact: argv.includes("--compact"), ui });
  return exitCodeOf(results, compared);
};
