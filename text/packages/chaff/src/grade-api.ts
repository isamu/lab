// `chaffjs/grade`: chaff's grader for an in-process eval harness (spec §29.6). One output at a time, with the same
// result as one line of `chaff grade --out`: both go through gradeItem with the same settings and stamp. A separate entry
// from `chaffjs/api`, so the plugin API's version and the result's shape are not bound to one number.
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { packageFor } from "./adapter-load.ts";
import { CLI_TEXT } from "./cli-text.ts";
import { EMPTY, loadConfig, type Config } from "./config/load.ts";
import { withStyle } from "./config/style.ts";
import { withExtensions } from "./extension/load.ts";
import { GENRES } from "./genre.ts";
import { gradeItem, type GradeSetup } from "./grade/grade-item.ts";
import { readItem } from "./grade/item.ts";
import type { GradeResult } from "./grade/result.ts";
import { parseRubric, type Rubric } from "./grade/rubric.ts";
import { gradeSetup } from "./grade/setup.ts";
import { GRADE_TEXT } from "./grade/text.ts";
import { compareVariantGroups, type VariantComparison } from "./grade/variants.ts";
import { variantGroupsOf, type VariantInput } from "./grade/variants-input.ts";
import { settingProblems } from "./setting-problems.ts";
import { loadStyles } from "./style-load.ts";

export type {
  FailedCitation,
  GradeCitations,
  GradeContexts,
  GradeFact,
  GradeFacts,
  GradeFinding,
  GradeResult,
  GradeScore,
  NotRunEntry,
  ScoreItem,
  Stamp,
  SupportedFact,
} from "./grade/result.ts";
export type { OutputSize } from "./grade/rates.ts";
export { toScorer, type ChaffScore } from "./grade/scorer.ts";
export type { Disagreement, VariantColumn, VariantComparison, VariantRates } from "./grade/variants.ts";
export type { VariantInput } from "./grade/variants-input.ts";

export type GradeOptions = {
  /** The result's id. "output" when left out. */
  readonly id?: string;
  /** The document the output was made from: facts are checked against it, as `chaff compare` does. */
  readonly reference?: string;
  /** Each source's name and text. */
  readonly sources?: Readonly<Record<string, string>>;
  /** What the output quoted. `source` may be left out when there is one source. */
  readonly citations?: readonly { readonly source?: string; readonly address: string; readonly quote: string }[];
  /** The retrieved passages the output was meant to rest on: each fact of the output is looked for in them. */
  readonly contexts?: readonly string[];
  readonly language?: string;
  readonly genre?: string;
  /** The prompt, model or setting that produced the output, kept on the result for compareVariants(). */
  readonly variant?: string;
  /** Run the experimental rules too, as --experimental does. chaff.yaml's `experimental` when left out. */
  readonly experimental?: boolean;
  /** chaff.yaml's path, or settings already read. Without it chaff's defaults apply and no file is read. */
  readonly config?: string | Config;
};

/** An input or a chaff.yaml grade() cannot use: the same cases end `chaff grade` with exit 2. */
export class GradeInputError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(problems.join("\n"));
    this.name = "GradeInputError";
    this.problems = problems;
  }
}

const TEXT = GRADE_TEXT.en;

/** Each chaff.yaml read, by its path and when it was last changed: one file is read and its code loaded once. */
const readConfigs = new Map<string, Config>();

const KEPT = 16;

/** Adds to a cache, dropping the oldest entry past KEPT. */
const remember = <T>(cache: Map<string, T>, key: string, value: T): T => {
  cache.set(key, value);
  const [oldest] = cache.keys();
  if (cache.size > KEPT && oldest !== undefined) cache.delete(oldest);
  return value;
};

/** chaff.yaml read as the command line reads it: its style applied and the code it names loaded. */
const readConfig = async (path: string): Promise<Config> => {
  const file = resolve(path);
  const key = `${file}\n${String(statSync(file).mtimeMs)}`;
  return readConfigs.get(key) ?? remember(readConfigs, key, await withExtensions(withStyle(loadConfig(file), loadStyles())));
};

/** A chaff.yaml that is missing or not YAML is an input grade() cannot use, as it is for the command line. */
const readNamedConfig = async (path: string): Promise<Config> => {
  try {
    return await readConfig(path);
  } catch (error) {
    throw new GradeInputError([TEXT.unreadable(path, error instanceof Error ? error.message : String(error))]);
  }
};

/** The settings to grade with, checked as the command line checks them, whether read here or given already read. */
const configOf = async (given: string | Config | undefined): Promise<Config> => {
  if (given === undefined) return EMPTY;
  const config = typeof given === "string" ? await readNamedConfig(given) : given;
  const problems = settingProblems("grade", undefined, config, CLI_TEXT.en);
  if (problems.length > 0) throw new GradeInputError(problems);
  return config;
};

const rubricOf = (config: Config): Rubric | undefined => {
  const parsed = parseRubric(config.grade);
  if ("problems" in parsed) throw new GradeInputError(parsed.problems.map((problem) => TEXT.rubricProblem(problem)));
  return parsed.rubric;
};

/**
 * Setups for each settings object, by what else decides them, so a harness grading many outputs loads the language
 * packages and hashes the rules once. Keyed by the object itself: two chaff.yaml files that read alike may load other code.
 */
const setups = new WeakMap<Config, Map<string, Promise<GradeSetup>>>();

const setupFor = (config: Config, experimental: boolean, languages: readonly string[]): Promise<GradeSetup> => {
  const run = { experimental, genre: undefined };
  const own = setups.get(config) ?? new Map<string, Promise<GradeSetup>>();
  setups.set(config, own);
  const key = `${String(experimental)}\n${languages.join(",")}`;
  const known = own.get(key);
  if (known !== undefined) return known;
  const made = remember(own, key, gradeSetup(config, run, languages, rubricOf(config)));
  // A language package that failed to load may be installed before the next call: do not keep the failure.
  made.catch(() => own.delete(key));
  return made;
};

/** The setup, or GradeInputError when a language package cannot be loaded, as `chaff grade` ends with 2 then. */
const loadedSetup = async (config: Config, experimental: boolean, languages: readonly string[]): Promise<GradeSetup> => {
  try {
    return await setupFor(config, experimental, languages);
  } catch (error) {
    if (error instanceof GradeInputError) throw error;
    throw new GradeInputError([TEXT.cannotLoad(error instanceof Error ? error.message : String(error))]);
  }
};

/**
 * Grades one output (spec §29.6): its findings and rates, its facts against `reference`, its `citations` against
 * `sources`, and pass or fail by chaff.yaml's `grade:` or the default. Reads a file only when `config` is a path, and
 * never writes one. Throws GradeInputError for an input or a chaff.yaml `chaff grade` would refuse with exit 2.
 */
export const grade = async (output: string, options: GradeOptions = {}): Promise<GradeResult> => {
  const config = await configOf(options.config);
  const raw = {
    id: options.id ?? "output",
    output,
    reference: options.reference,
    sources: options.sources,
    citations: options.citations,
    contexts: options.contexts,
    language: options.language,
    genre: options.genre,
    variant: options.variant,
  };
  const read = readItem(raw, { isLanguage: (language) => packageFor(language) !== undefined, genres: GENRES });
  if ("problem" in read) throw new GradeInputError([TEXT.problem(read.problem)]);
  const languages = read.item.language === undefined ? [] : [read.item.language];
  return gradeItem(read.item, await loadedSetup(config, options.experimental ?? config.experimental, languages));
};

/**
 * Several variants' results side by side on the same inputs (spec §29.5), as `chaff grade` prints them for a file whose
 * lines carry a variant: per variant the pass rate, each rule's rate, facts dropped and added, and failed quotations,
 * over the ids every variant answered; and the ids where pass or fail differs. Takes results labelled by `variant`
 * (grade() with `variant`, or `chaff grade --out`), or `{ [variant]: results }`. Throws GradeInputError for a result
 * without an id or a variant, or an id given twice in one variant.
 */
export const compareVariants = (results: VariantInput): VariantComparison => {
  const read = variantGroupsOf(results);
  if ("problems" in read) throw new GradeInputError(read.problems);
  return compareVariantGroups(read.groups);
};
