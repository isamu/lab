// Runs chaff's command line on every rule's example, before and after, and keeps what it said about that rule.
// The site shows these messages beside the examples, so a page never shows a message chaff no longer prints.
//   node scripts/rule-examples.ts <out.json>
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { stringify } from "yaml";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";
import type { ExampleFinding, ExampleOutcome, RuleExample } from "../packages/chaff/src/rule-guide.ts";
import { runCli } from "../test/cli-run.ts";
import { measuredOffOn } from "./rules-measure-files.ts";

const BEFORE = "before.md";
const AFTER = "after.md";
/** The third file of a rule that compares documents: before and after are each compared with it (and with each other). Its name
 * sorts first, so a message that names a file of the usual way names this one. */
const OTHER = "a.md";
const SARIF = "out.sarif";
const ARGS = [BEFORE, AFTER, "--experimental", "--compact", "--sarif", SARIF];

type SarifResult = {
  ruleId: string;
  message: { text: string };
  locations: { physicalLocation: { artifactLocation: { uri: string }; region: { startLine: number; startColumn?: number } } }[];
};

const isSarifResult = (value: unknown): value is SarifResult =>
  typeof value === "object" && value !== null && "ruleId" in value && "message" in value && "locations" in value;

const resultsOf = (sarif: unknown): SarifResult[] => {
  if (typeof sarif !== "object" || sarif === null || !("runs" in sarif) || !Array.isArray(sarif.runs)) return [];
  return sarif.runs.flatMap((run: unknown) =>
    typeof run === "object" && run !== null && "results" in run && Array.isArray(run.results) ? run.results.filter(isSarifResult) : [],
  );
};

const findingsIn = (results: readonly SarifResult[], rule: string, file: string): ExampleFinding[] =>
  results
    .filter((result) => result.ruleId === `chaff/${rule}` && result.locations[0]?.physicalLocation.artifactLocation.uri.endsWith(file))
    .map((result) => {
      const region = result.locations[0]?.physicalLocation.region;
      return { line: region?.startLine ?? 0, column: region?.startColumn ?? 1, message: result.message.text };
    });

/** The genre the reference says its examples run with. An example that needs another names it in its config. */
export const EXAMPLE_GENRE = "business/report";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The example's chaff.yaml: the language pinned, plus what the example says it needs. The rules the genre is off for only
 * by measurement run too: the reference shows what a rule finds, and its page says where it does not run by default.
 */
const configOf = (language: string, example: RuleExample): string => {
  const genre = typeof example.config?.["genre"] === "string" ? example.config["genre"] : EXAMPLE_GENRE;
  const named = isRecord(example.config?.["rules"]) ? example.config["rules"] : {};
  return stringify({ language, genre: EXAMPLE_GENRE, ...example.config, rules: { ...measuredOffOn(genre), ...named } });
};

/**
 * The ordinary passage put after a padded example: long enough for the rules that measure a whole document
 * (500 characters, 200 words), and written to give none of them anything to count.
 */
const PADDING: Readonly<Record<string, string>> = {
  ja: [
    "私たちの課では、毎週月曜の朝に短い打ち合わせを開いています。",
    "先週に終えた仕事と、今週に手を付ける仕事を、一人ずつ順に話します。",
    "困っていることがあれば、その場で手の空いている人を決めます。",
    "時間は十五分までと決めていて、長くなりそうな話は別の日に回します。",
    "\n\n",
    "議事録は当番が書き、その日のうちに共有のフォルダへ置きます。",
    "当番は名簿の順に毎週替わるので、誰か一人に書く仕事が偏ることはありません。",
    "書き方の決まりは簡単で、決まったことと、次に誰が何をするかだけを書きます。",
    "話し合いの途中で出た意見は、決まったことと分けて最後に並べます。",
    "\n\n",
    "新しく入った人には、最初の月だけ隣の席の人が付き、分からないことを聞ける相手になります。",
    "この進め方を始めてから、同じ質問を何度も受けることが減りました。",
    "打ち合わせの前に、話すことを三行ほどにまとめておくと、話が早く進みます。",
    "月の終わりには、一か月の議事録を読み返し、片付いていない仕事がないかを確かめます。",
    "\n\n",
    "残っていた仕事は、翌月の最初の打ち合わせで担当を決め直します。",
    "一人あたりにかかる時間は月に一時間ほどで、それより多くの時間が浮いています。",
    "ほかの課から見学に来た人もいて、同じ進め方を試し始めたところもあります。",
  ].join(""),
  en: [
    "Our team meets for a short session every Monday morning.",
    "\n\n",
    "Each person in turn says what they finished last week and what they will start this week.",
    "If someone needs help, we choose a person with time to spare, there and then.",
    "The meeting has a limit of fifteen minutes, and any topic that needs longer moves to another day.",
    "A note taker writes the minutes and puts them in the shared folder the same day.",
    "\n\n",
    "The role moves down the list each week, so the writing never falls on one person.",
    "The format is simple: what we decided, and who does what next.",
    "Opinions raised along the way go in a separate list at the end, apart from the decisions.",
    "A new member sits next to a colleague for the first month, who answers their questions.",
    "\n\n",
    "Since we started working this way, we answer the same question far less often.",
    "Before the meeting, each person writes down what they want to raise in two or three lines, which keeps the discussion moving.",
    "At the end of the month, we read back through the minutes to look for any work that was left open.",
    "Anything still open gets a new owner at the first meeting of the next month.",
    "\n\n",
    "The whole routine costs each of us about an hour a month, and it saves far more than that.",
  ]
    .join(" ")
    .replaceAll(" \n\n ", "\n\n"),
};

export const withPadding = (text: string, example: RuleExample, language: string): string =>
  example.pad === true ? `${text.trimEnd()}\n\n${PADDING[language] ?? ""}\n` : text;

const runExample = async (rule: string, language: string, example: RuleExample): Promise<ExampleOutcome> => {
  const files = {
    "chaff.yaml": configOf(language, example),
    [BEFORE]: withPadding(example.before, example, language),
    [AFTER]: withPadding(example.after, example, language),
    ...(example.other === undefined ? {} : { [OTHER]: example.other }),
  };
  const args = example.other === undefined ? ARGS : [OTHER, ...ARGS];
  const run = await runCli(files, args, language === "ja" ? "ja_JP.UTF-8" : "en_US.UTF-8");
  const sarif: unknown = JSON.parse(readFileSync(join(run.dir, SARIF), "utf8"));
  rmSync(run.dir, { recursive: true, force: true });
  const results = resultsOf(sarif);
  return { rule, language, before: findingsIn(results, rule, BEFORE), after: findingsIn(results, rule, AFTER) };
};

const examplesOf = (rule: RuleDefinition): [string, RuleExample][] => Object.entries(rule.guide?.examples ?? {});

/** Every example of every rule, one command-line run per rule and language. */
export const runAllExamples = async (rules: readonly RuleDefinition[]): Promise<ExampleOutcome[]> => {
  const jobs = rules.flatMap((rule) => examplesOf(rule).map(([language, example]) => ({ rule: rule.id, language, example })));
  // One at a time: the command line runs in the example's directory, and the working directory is the process's.
  return jobs.reduce<Promise<ExampleOutcome[]>>(
    async (done, job) => [...(await done), await runExample(job.rule, job.language, job.example)],
    Promise.resolve([]),
  );
};

if (import.meta.main) {
  const out = process.argv[2];
  if (out === undefined) throw new Error("usage: node scripts/rule-examples.ts <out.json>");
  const outcomes = await runAllExamples(loadRules("en"));
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), `${JSON.stringify(outcomes, null, 2)}\n`, "utf8");
}
