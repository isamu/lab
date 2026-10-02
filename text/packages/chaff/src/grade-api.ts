// `chaffjs/grade`: chaff's grader for an in-process eval harness (spec §29.6). One output at a time, with the same
// result as one line of `chaff grade --out`: both go through gradeItem with the same settings and stamp. A separate entry
// from `chaffjs/api`, so the plugin API's version and the result's shape are not bound to one number.
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
import { digestOf, settingsOf } from "./grade/stamp.ts";
import { GRADE_TEXT } from "./grade/text.ts";
import { settingProblems } from "./setting-problems.ts";
import { loadStyles } from "./style-load.ts";

export type {
  FailedCitation,
  GradeCitations,
  GradeFact,
  GradeFacts,
  GradeFinding,
  GradeResult,
  GradeScore,
  NotRunEntry,
  ScoreItem,
  Stamp,
} from "./grade/result.ts";
export type { OutputSize } from "./grade/rates.ts";

export type GradeOptions = {
  /** The result's id. "output" when left out. */
  readonly id?: string;
  /** The document the output was made from: facts are checked against it, as `chaff compare` does. */
  readonly reference?: string;
  /** Each source's name and text. */
  readonly sources?: Readonly<Record<string, string>>;
  /** What the output quoted. `source` may be left out when there is one source. */
  readonly citations?: readonly { readonly source?: string; readonly address: string; readonly quote: string }[];
  readonly language?: string;
  readonly genre?: string;
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

/** chaff.yaml read as the command line reads it: its style applied and the code it names loaded, then checked. */
const configOf = async (given: string | Config | undefined): Promise<Config> => {
  if (given === undefined) return EMPTY;
  if (typeof given !== "string") return given;
  const config = await withExtensions(withStyle(loadConfig(resolve(given)), loadStyles()));
  const problems = settingProblems("grade", undefined, config, CLI_TEXT.en);
  if (problems.length > 0) throw new GradeInputError(problems);
  return config;
};

const rubricOf = (config: Config): Rubric | undefined => {
  const parsed = parseRubric(config.grade);
  if ("problems" in parsed) throw new GradeInputError(parsed.problems.map((problem) => TEXT.rubricProblem(problem)));
  return parsed.rubric;
};

/** Setups by what decides them, so a harness grading many outputs loads the language packages and hashes the rules once. */
const setups = new Map<string, Promise<GradeSetup>>();

const SETUPS_KEPT = 16;

const setupFor = (config: Config, experimental: boolean, languages: readonly string[]): Promise<GradeSetup> => {
  const run = { experimental, genre: undefined };
  const key = digestOf({ settings: settingsOf({ config, ...run }), customRules: config.customRules ?? null, plugins: config.plugins ?? null, languages });
  const known = setups.get(key);
  if (known !== undefined) return known;
  const made = gradeSetup(config, run, languages, rubricOf(config));
  setups.set(key, made);
  // A language package that failed to load may be installed before the next call: do not keep the failure.
  made.catch(() => setups.delete(key));
  const [oldest] = setups.keys();
  if (setups.size > SETUPS_KEPT && oldest !== undefined) setups.delete(oldest);
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
    language: options.language,
    genre: options.genre,
  };
  const read = readItem(raw, { isLanguage: (language) => packageFor(language) !== undefined, genres: GENRES });
  if ("problem" in read) throw new GradeInputError([TEXT.problem(read.problem)]);
  const languages = read.item.language === undefined ? [] : [read.item.language];
  return gradeItem(read.item, await loadedSetup(config, options.experimental ?? config.experimental, languages));
};
