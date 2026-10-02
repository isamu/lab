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
import { summaryOf } from "../grade/summary.ts";
import { GRADE_TEXT, type GradeText } from "../grade/text.ts";
import { sharedLanguage, type UiLanguage } from "../ui.ts";

/** Exit codes (spec §29.3). 2 keeps "the grader did not run" apart from "an output is bad" at a CI gate. */
export const GRADE_EXIT = { passed: 0, failed: 1, unreadable: 2 } as const;

const VALUED: ReadonlySet<string> = new Set(["--out", "--genre"]);

export const gradeTargets = (argv: readonly string[]): string[] =>
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

const setupFor = async (items: readonly GradeItem[], argv: readonly string[], context: GradeContext, text: GradeText): Promise<GradeSetup | undefined> => {
  const languages = items.flatMap((item) => (item.language === undefined ? [] : [item.language]));
  const run = { experimental: context.config.experimental || argv.includes("--experimental"), genre: context.flag(argv, "--genre") };
  try {
    return await gradeSetup(context.config, run, languages);
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

const printSummary = (path: string, results: readonly GradeResult[], argv: readonly string[], text: GradeText): void => {
  const summary = summaryOf(results);
  if (argv.includes("--json")) console.log(JSON.stringify(summary, null, 2));
  else if (argv.includes("--compact")) console.log(renderCompact(path, results, summary, text));
  else console.log(renderSummary(path, summary, text));
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
  const items = await readItems(path, host);
  const setup = items === undefined ? undefined : await setupFor(items, argv, context, host);
  if (items === undefined || setup === undefined) return GRADE_EXIT.unreadable;
  const results = await gradeInOrder(items, setup);
  writeResults(context.flag(argv, "--out"), results, host);
  printSummary(
    path,
    results,
    argv,
    GRADE_TEXT[
      sharedLanguage(
        results.map((result) => result.language),
        context.ui,
      )
    ],
  );
  return results.every((result) => result.pass) ? GRADE_EXIT.passed : GRADE_EXIT.failed;
};
