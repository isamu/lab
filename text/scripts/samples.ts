// Runs chaff on every rule sample (docs/samples/<language>/<rule-id>.md): the original and the corrected text, and
// `chaff explain` for the rule. With --update it writes what chaff printed into the sample's chaff-output and
// chaff-explain blocks, and rewrites each language's index (README.md). test/test_rule_samples.ts checks the same runs.
//   node scripts/samples.ts            print the samples whose screens or index differ from chaff (yarn samples:check)
//   node scripts/samples.ts --update   rewrite them (yarn samples:update)
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { configOf } from "../packages/chaff/src/config/load.ts";
import { settingWarnings } from "../packages/chaff/src/config/warnings.ts";
import { uiLanguageOf } from "../packages/chaff/src/ui.ts";
import { runCli } from "../test/cli-run.ts";
import { mapInChildren } from "./in-children.ts";
import { blockBody, commandOf, explainArgs, plainScreenOf, sampleArgs, sampleOf, screenOf, withBlock, type Sample } from "./samples-parse.ts";
import { indexOf } from "./samples-index.ts";

const ROOT = join(import.meta.dirname, "..");
export const SAMPLES = join("docs", "samples");
export const SAMPLE_LANGUAGES = ["ja", "en"] as const;
const LOCALES: Readonly<Record<string, string>> = { ja: "ja_JP.UTF-8", en: "en_US.UTF-8" };
const INDEX = "README.md";
const SARIF = "chaff-sample.sarif";
export const OUTPUT_TAG = "chaff-output";
export const EXPLAIN_TAG = "chaff-explain";

/** A sample's file under text/, as a test or a message names it ("docs/samples/ja/no-mixed-desumasu.md"). */
export type SampleFile = { readonly language: string; readonly path: string };

/** What chaff said on one sample: the rules it reported on each text, the two screens, and the settings it could not read. */
export type SampleRun = {
  readonly path: string;
  readonly language: string;
  readonly rule: string;
  readonly afterAllows: readonly string[];
  readonly beforeRules: readonly string[];
  readonly afterRules: readonly string[];
  readonly screen: string;
  readonly explain: string;
  readonly settingProblems: readonly string[];
  readonly settingKeys: readonly string[];
};

/** Every sample, by language; the index is not one. */
export const sampleFiles = (): SampleFile[] =>
  SAMPLE_LANGUAGES.flatMap((language) => {
    const dir = join(ROOT, SAMPLES, language);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((name) => name.endsWith(".md") && name !== INDEX)
      .toSorted((left, right) => left.localeCompare(right, "en"))
      .map((name) => ({ language, path: [SAMPLES, language, name].join("/") }));
  });

/** The file's text with Windows line ends read as \n, so a checkout on Windows parses the same. */
export const readSample = (path: string): string => readFileSync(join(ROOT, path), "utf8").replaceAll("\r\n", "\n");

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value);

const resultRules = (run: unknown): string[] =>
  isRecord(run) && Array.isArray(run["results"])
    ? run["results"].flatMap((result: unknown) => (isRecord(result) && typeof result["ruleId"] === "string" ? [result["ruleId"].replace(/^chaff\//u, "")] : []))
    : [];

/** The ids of the rules a SARIF file reports, once each, in the order first reported. */
const sarifRules = (path: string): string[] => {
  const sarif: unknown = JSON.parse(readFileSync(path, "utf8"));
  const runs = isRecord(sarif) && Array.isArray(sarif["runs"]) ? sarif["runs"] : [];
  return [...new Set(runs.flatMap(resultRules))];
};

const filesOf = (sample: Sample, document: string): Record<string, string> => ({
  ...(sample.config === undefined ? {} : { "chaff.yaml": sample.config }),
  ...sample.others,
  [sample.meta.file]: document,
});

/** chaff on one text of the sample, as the screen shows it, and the rules it reported. */
const runText = async (sample: Sample, document: string, language: string): Promise<{ output: string; rules: string[] }> => {
  const run = await runCli(filesOf(sample, document), [...sampleArgs(sample), "--sarif", SARIF], LOCALES[language]);
  try {
    return { output: run.both, rules: sarifRules(join(run.dir, SARIF)) };
  } finally {
    rmSync(run.dir, { recursive: true, force: true });
  }
};

const explainOf = async (sample: Sample, language: string): Promise<string> => {
  const args = explainArgs(sample);
  const run = await runCli({}, args, LOCALES[language]);
  rmSync(run.dir, { recursive: true, force: true });
  return plainScreenOf(commandOf(args), run.both);
};

/** The chaff.yaml blocks of a sample that chaff would not apply as written, and every top-level key they use. */
const settingsOf = (sample: Sample, language: string, path: string): { problems: string[]; keys: string[] } => {
  const rules = loadRules(language);
  const blocks = [...(sample.config === undefined ? [] : [sample.config]), ...sample.settings];
  const read = blocks.map((block): unknown => parse(block));
  const problems = read.flatMap((raw) => settingWarnings(configOf(raw, `${path} (chaff.yaml)`), rules, uiLanguageOf(language)));
  return { problems, keys: [...new Set(read.flatMap((raw) => (isRecord(raw) ? Object.keys(raw) : [])))] };
};

const runSample = async (file: SampleFile): Promise<SampleRun> => {
  const sample = sampleOf(readSample(file.path), file.path);
  const before = await runText(sample, sample.before, file.language);
  const after = await runText(sample, sample.after, file.language);
  const settings = settingsOf(sample, file.language, file.path);
  return {
    path: file.path,
    language: file.language,
    rule: sample.meta.rule,
    afterAllows: sample.meta.afterAllows,
    beforeRules: before.rules,
    afterRules: after.rules,
    screen: screenOf(commandOf(sampleArgs(sample)), before.output, [sample.meta.file, ...Object.keys(sample.others)], file.path),
    explain: await explainOf(sample, file.language),
    settingProblems: settings.problems,
    settingKeys: settings.keys,
  };
};

const isSampleFile = (value: unknown): value is SampleFile => isRecord(value) && typeof value["language"] === "string" && typeof value["path"] === "string";

/** The runs of these samples in this process, one at a time: the command line runs in the process's working directory. */
export const runSamplesHere = async (files: unknown): Promise<SampleRun[]> => {
  if (!Array.isArray(files) || !files.every(isSampleFile)) throw new Error("samples: runSamplesHere takes a list of { language, path }");
  return files.reduce<Promise<SampleRun[]>>(async (done, file) => [...(await done), await runSample(file)], Promise.resolve([]));
};

const isSampleRun = (value: unknown): value is SampleRun =>
  isRecord(value) && typeof value["path"] === "string" && typeof value["screen"] === "string" && Array.isArray(value["beforeRules"]);

/** Every sample run, side by side in several processes. */
export const runSamples = async (files: readonly SampleFile[] = sampleFiles()): Promise<SampleRun[]> => {
  const runs = await mapInChildren(import.meta.url, "runSamplesHere", files);
  if (!runs.every(isSampleRun)) throw new Error("samples: a worker returned something other than sample runs");
  return runs;
};

/** The sample's text with its two screens as chaff prints them now. */
export const updatedSample = (text: string, run: SampleRun): string =>
  withBlock(withBlock(text, OUTPUT_TAG, run.screen, run.path), EXPLAIN_TAG, run.explain, run.path);

export const indexPath = (language: string): string => [SAMPLES, language, INDEX].join("/");

/** The index of one language as the samples on disk make it. */
export const expectedIndex = (language: string): string => {
  const sampled = new Set(sampleFiles().flatMap((file) => (file.language === language ? [sampleOf(readSample(file.path), file.path).meta.rule] : [])));
  return indexOf(language, loadRules(language), sampled);
};

const currentIndex = (language: string): string | undefined => (existsSync(join(ROOT, indexPath(language))) ? readSample(indexPath(language)) : undefined);

/** The sample's screens as written, to compare with a run. */
export const shownScreens = (path: string): { screen: string | undefined; explain: string | undefined } => {
  const text = readSample(path);
  return { screen: blockBody(text, OUTPUT_TAG, path), explain: blockBody(text, EXPLAIN_TAG, path) };
};

const differs = (run: SampleRun): boolean => {
  const shown = shownScreens(run.path);
  return shown.screen !== run.screen || shown.explain !== run.explain;
};

const main = async (update: boolean): Promise<number> => {
  const stale = (await runSamples()).filter(differs);
  const staleIndexes = SAMPLE_LANGUAGES.filter((language) => currentIndex(language) !== expectedIndex(language));
  if (update) {
    stale.forEach((run) => writeFileSync(join(ROOT, run.path), updatedSample(readSample(run.path), run)));
    staleIndexes.forEach((language) => writeFileSync(join(ROOT, indexPath(language)), expectedIndex(language)));
  }
  const changed = [...stale.map((run) => run.path), ...staleIndexes.map(indexPath)];
  changed.forEach((path) => console.log(`${update ? "rewrote" : "differs from chaff"}: ${path}`));
  if (!update && changed.length > 0) console.log("yarn samples:update rewrites them to what chaff prints now (read the diff)");
  return update || changed.length === 0 ? 0 : 1;
};

if (import.meta.main) process.exitCode = await main(process.argv.includes("--update"));
