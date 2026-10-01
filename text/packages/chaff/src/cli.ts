import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadAdapter, packageFor } from "./adapter-load.ts";
import { CONFIG_FILE, type Config } from "./config/load.ts";
import { applyByPath } from "./config/by-path.ts";
import { applyLevel } from "./config/write.ts";
import { buildDocument, teamRules } from "./document.ts";
import { guessLanguage } from "./detect.ts";
import { collectTargets, readDocumentFile } from "./files.ts";
import { BASELINE_FILE, fingerprints, readBaseline, splitByBaseline, writeBaseline } from "./baseline.ts";
import { applySuppressions } from "./stet.ts";
import type { PerFile } from "./render/suppressions.ts";
import { runSuppressions } from "./commands/suppressions.ts";
import { clock, describeChange, snapshotOf, watchPaths, type Snapshot } from "./watch.ts";
import { runEval } from "./commands/eval.ts";
import { runTest } from "./commands/test.ts";
import { GENRES } from "./genre.ts";
import { resolveGenre } from "./resolve-genre.ts";
import { runInit } from "./init.ts";
import { initGenre } from "./commands/init-ask.ts";
import { targetsOf, withExperimental } from "./cli-args.ts";
import { rulesOf } from "./custom/load.ts";
import { renderCompact } from "./render/compact.ts";
import { renderExplain } from "./render/explain.ts";
import { renderFriendly } from "./render/friendly.ts";
import { renderGenres } from "./render/genres.ts";
import { loadGenres, presetLevels } from "./genre-load.ts";
import { fileHeader } from "./file-header.ts";
import { rulesJson } from "./render/rules-json.ts";
import { rulesTable } from "./render/rules-table.ts";
import { renderSarif } from "./render/sarif.ts";
import { VERSION, VERSION_LINES } from "./version.ts";
import type { TreeContext } from "./commands/tree.ts";
import { documentCommands } from "./commands/document-commands.ts";
import { runSkill } from "./commands/skill.ts";
import { fixPlanTargets, runFixPlan } from "./commands/fix-plan.ts";
import { runConditions, runFeedback, settingsOf, type Checked } from "./commands/feedback.ts";
import { homedir } from "node:os";
import { settingWarnings } from "./config/warnings.ts";
import { readConfigIn } from "./config/read.ts";
import { optionLayersOf, settingSourcesOf } from "./config/option-problems.ts";
import { renderSummary, type FileOutcome } from "./render/summary.ts";
import { neededBy, runRulesWith } from "./run.ts";
import type { Finding, Level, RuleDefinition } from "./plugin.ts";
import { CLI_TEXT, type CliText, type GenreSource } from "./cli-text.ts";
import { hostLanguage, sharedLanguage, uiLanguageOf, type UiLanguage } from "./ui.ts";
import { profileFor } from "./profile/for-file.ts";
import { notRunAmong } from "./not-run.ts";
import { settingProblems } from "./setting-problems.ts";

/** Text for output that is not about one document. */
const hostText = (config: Config): CliText => CLI_TEXT[hostLanguage(config.language, process.env)];

const readConfig = (): Config => readConfigIn(process.cwd());

/** resolveGenre with this run's --genre, for the commands that take it as a dependency. */
const genreFrom =
  (argv: readonly string[]) =>
  (path: string, source: string, config: Config): { genre: string; from: GenreSource } =>
    resolveGenre(path, source, config, flag(argv, "--genre"));

const findRule = (rules: readonly RuleDefinition[], id: string | undefined): RuleDefinition | undefined => rules.find((rule) => rule.id === id);

const changeSetting = (command: Level, ruleId: string | undefined, why: string | undefined): number => {
  const config = readConfig();
  const language = config.language ?? hostLanguage(undefined, process.env);
  const rule = findRule(rulesOf(language, config), ruleId);
  if (rule === undefined) {
    console.error(hostText(config).unknownRule(ruleId ?? hostText(config).unnamed));
    return 1;
  }
  const outcome = applyLevel(join(process.cwd(), CONFIG_FILE), rule, command, why, language, process.env["USER"] ?? "unknown");
  console.log(outcome.message);
  return outcome.ok ? 0 : 1;
};

const flag = (argv: readonly string[], name: string): string | undefined => {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
};

type Inspected = {
  readonly text: string;
  readonly rules: readonly RuleDefinition[];
  /** ファイルごとの言語。by_path で 1 つの repo に 2 言語が混ざる。 */
  readonly language: string;
  readonly genre: string;
  readonly outcome: FileOutcome;
  readonly perFile: PerFile;
  readonly checked: Omit<Checked, "conditions">;
  /** stet で黙らせたものを除いた、baseline で棚上げする前の指摘。fingerprint は baseline を書くときだけ作る。 */
  readonly kept: readonly Finding[];
};

const inspect = async (path: string, config: Config, argv: readonly string[]): Promise<Inspected> => {
  const source = await readDocumentFile(path);
  const language = applyByPath(config.byPath, config.baseDir, path).language ?? config.language ?? guessLanguage(source).language;
  const adapter = await loadAdapter(language);
  const { genre, from, unread } = resolveGenre(path, source, config, flag(argv, "--genre"));
  if (unread !== undefined) console.error(`chaff: ${CLI_TEXT[uiLanguageOf(language)].unreadFrontMatterGenre(path, unread, GENRES)}`);
  const rules = rulesOf(language, config);
  const experimental = config.experimental || argv.includes("--experimental");
  await adapter.prepare?.(neededBy(rules, config.rules, experimental, genre, language));
  const doc = buildDocument(path, source, adapter, teamRules(config), profileFor(config, path, source, language, genre));
  const raw = runRulesWith(doc, rules, { settings: config.rules, experimental, genre, limits: config.limits, optionLayers: optionLayersOf(config) });
  // 応答は 3 つ。stet で黙らせたものは、ここで落とす。
  const applied = applySuppressions(
    source,
    raw.findings,
    doc.sections.map((section) => section.span),
  );
  const baseline = argv.includes("--show-baseline") ? undefined : readBaseline(join(process.cwd(), BASELINE_FILE));
  const split = splitByBaseline(path, applied.kept, baseline);
  const result = { ...raw, findings: split.fresh };
  const { header, notes } = fileHeader(path, source, language, { genre, from, unread }, { shelved: split.shelved, hushed: applied.suppressed.length });
  const notRun = notRunAmong(applied.named, raw.skipped);
  const text = argv.includes("--compact") ? renderCompact(header, result, rules, language) : renderFriendly(header, result, rules, language, notes);
  return {
    text,
    rules,
    language,
    genre,
    outcome: { path, findings: split.fresh, notRun: raw.skipped.length },
    perFile: { path, suppressed: applied.suppressed, reasonless: applied.unusedReasonless, notRun },
    checked: { findings: split.fresh, rules, language, genre, skipped: raw.skipped },
    kept: applied.kept,
  };
};

/**
 * 指摘を PR の変更行に出すための出口。--sarif <path> を書いたときだけ作る。
 * 端末の出力は変えない。CI で上げるためのファイルが増えるだけ。
 */
const writeSarif = (results: readonly Inspected[], argv: readonly string[]): void => {
  const path = flag(argv, "--sarif");
  if (path === undefined) return;
  // 文言はファイルの言語で描く。by_path で 1 つの repo に 2 言語が混ざるため。
  const located = results.flatMap((result) =>
    result.outcome.findings.map((finding) => ({ path: result.outcome.path, finding, language: result.language, rules: result.rules })),
  );
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderSarif(located, VERSION), "utf8");
  console.log(hostText(readConfig()).sarifWritten(path, located.length));
};

/** 効いていない設定は、結果の前に一度だけ言う。標準エラーに出すので、JSON や SARIF の出力は汚さない。 */
const warnRuleProblems = (config: Config, language: string): void =>
  settingWarnings(config, rulesOf(language, config), hostLanguage(config.language, process.env)).forEach((problem) => console.error(`chaff: ${problem}`));

/** Several files end with one summary: in their language when they share one, else the host's. */
const summaryLanguage = (results: readonly Inspected[], config: Config): UiLanguage => {
  const languages = results.map((result) => result.language);
  return sharedLanguage(languages, hostLanguage(config.language, process.env));
};

const lint = async (targets: readonly string[], argv: readonly string[]): Promise<number> => {
  const paths = collectTargets(targets);
  const config = readConfig();
  if (paths.length === 0) {
    // 0 件を成功にすると「CI は通っているが何も検証していない」状態が続く。§14。
    console.error(hostText(config).noMarkdown(targets.join(", ")));
    return 1;
  }
  const language = config.language ?? "ja";
  if (packageFor(language) === undefined) {
    console.error(hostText(config).noAdapter(language));
    return 1;
  }
  warnRuleProblems(config, language);
  const results = await Promise.all(paths.map((path) => inspect(path, config, argv)));
  writeSarif(results, argv);
  results.filter((result) => result.outcome.findings.length > 0 || paths.length === 1).forEach((result) => console.log(result.text));
  renderSummary(
    results.map((result) => result.outcome),
    summaryLanguage(results, config),
  ).forEach((line) => console.log(line));
  return results.some((result) => result.outcome.findings.some((finding) => finding.severity === "error")) ? 1 : 0;
};

/**
 * 書いている最中は、全件を出し直されても何が変わったのか分からない。
 * 差分だけを出す。workflow spec §11。
 */
const runWatch = async (targets: readonly string[], argv: readonly string[]): Promise<number> => {
  const paths = collectTargets(targets);
  const config = readConfig();
  const text = hostText(config);
  if (paths.length === 0) {
    console.error(text.noMarkdown(targets.join(", ")));
    return 1;
  }
  warnRuleProblems(config, config.language ?? "ja");
  const seen = new Map<string, Snapshot>();
  const once = async (path: string, first: boolean): Promise<void> => {
    const result = await inspect(path, config, argv);
    const after = snapshotOf(result.outcome.findings);
    const before = seen.get(path) ?? {};
    seen.set(path, after);
    if (first) return;
    const change = describeChange(before, after, text.findingsUnit);
    console.log(`${clock()}  ${path}  ${change ?? text.unchanged}`);
  };
  await Promise.all(paths.map((path) => once(path, true)));
  const totals = [...seen.values()].reduce((sum, snapshot) => sum + Object.values(snapshot).reduce((inner, count) => inner + count, 0), 0);
  console.log(text.watching(paths.length, totals));
  console.log(text.watchHint);
  const stop = watchPaths(paths, (path) => void once(path, false));
  process.on("SIGINT", () => {
    stop();
    process.exit(0);
  });
  return new Promise(() => undefined);
};

/** genreFlag: --genre, which wins over chaff.yaml's genre here as it does in a run. */
const explain = (ruleId: string | undefined, genreFlag: string | undefined): number => {
  const config = readConfig();
  const genre = genreFlag ?? config.genre;
  // The rule's limits differ by language (characters for Japanese, words for English): explain in the one being written.
  const language = config.language ?? hostLanguage(undefined, process.env);
  const text = CLI_TEXT[uiLanguageOf(language)];
  const rules = rulesOf(language, config);
  const rule = findRule(rules, ruleId);
  if (rule === undefined) {
    const list = rules.map((entry) => `  ${entry.id}`).join("\n");
    console.error(text.unknownRuleWithList(ruleId ?? text.unnamed, list));
    return 1;
  }
  const preset = genre === undefined ? {} : presetLevels(genre);
  const current = config.rules[rule.id] ?? preset[rule.id] ?? (rule.status === "experimental" && !config.experimental ? "off" : "normal");
  console.log(renderExplain(rule, current, language, genre, settingSourcesOf(config, rule.id)));
  return 0;
};

const runBaseline = async (targets: readonly string[], argv: readonly string[]): Promise<number> => {
  const paths = collectTargets(targets.length > 0 ? targets : ["."]);
  const config = readConfig();
  if (paths.length === 0) {
    console.error(hostText(config).noMarkdownHere);
    return 1;
  }
  const results = await Promise.all(paths.map((path) => inspect(path, config, [...argv, "--show-baseline"])));
  const entries = results.flatMap((result) => fingerprints(result.outcome.path, result.kept));
  const file = join(process.cwd(), BASELINE_FILE);
  writeBaseline(file, entries);
  console.log(hostText(config).baselineDone(paths.length, entries.length, BASELINE_FILE).join("\n"));
  return 0;
};

/** A file's findings, shelved ones included: commands that look findings up are not asking what is new. */
const inspectAll = (config: Config, argv: readonly string[]) => (path: string) => inspect(path, config, [...argv, "--show-baseline"]);

type Handler = (argv: readonly string[]) => number | Promise<number>;

/** `--` で始まらない引数。対象のパス。 */
const positional = (argv: readonly string[]): string[] => targetsOf(argv.slice(1));

/** `rules --json` for an AI to read; `rules` alone, a table for a person. */
const showRules = (argv: readonly string[]): number => {
  const config = withExperimental(readConfig(), argv);
  const language = config.language ?? hostLanguage(undefined, process.env);
  warnRuleProblems(config, language);
  const genre = flag(argv, "--genre") ?? config.genre ?? "blog/tech";
  const rules = rulesOf(language, config);
  console.log(argv.includes("--json") ? rulesJson(rules, config, language, genre, optionLayersOf(config)) : rulesTable(rules, config, language, genre));
  return 0;
};

const showGenres = (): number => {
  console.log(renderGenres(loadGenres(), hostLanguage(readConfig().language, process.env)));
  return 0;
};

const treeContext = (): TreeContext => {
  const config = readConfig();
  return { config, flag, ui: hostLanguage(config.language, process.env) };
};

/** What eval and test share: the settings, this run's genre, and the language for what is not about one document. */
const measureContext = (argv: readonly string[]): { config: Config; resolveGenre: ReturnType<typeof genreFrom>; ui: UiLanguage } => {
  const config = readConfig();
  return { config, resolveGenre: genreFrom(argv), ui: hostLanguage(config.language, process.env) };
};

/** 分岐を数珠つなぎにせず表にする。足すときに main を太らせない。 */
const HANDLERS: Readonly<Record<string, Handler>> = {
  init: async (argv) => {
    const ui = hostLanguage(readConfig().language, process.env);
    const chosen = await initGenre(flag(argv, "--genre"), ui, process.cwd());
    if ("error" in chosen) console.error(chosen.error);
    else runInit(process.cwd(), chosen.genre, ui).forEach((line) => console.log(line));
    return "error" in chosen ? 1 : 0;
  },
  genres: showGenres,
  rules: showRules,
  explain: (argv) => explain(argv[1], flag(argv, "--genre")),
  eval: (argv) => runEval(positional(argv), argv, { ...measureContext(argv), flag }),
  ...documentCommands(treeContext),
  test: (argv) => runTest(positional(argv), argv, { ...measureContext(argv), inspect }),
  "fix-plan": (argv) =>
    runFixPlan(fixPlanTargets(argv), argv, { ...treeContext(), check: async (path) => (await inspectAll(readConfig(), argv)(path)).checked }),
  baseline: (argv) => runBaseline(positional(argv), argv),
  suppressions: (argv) => runSuppressions(positional(argv), inspectAll(readConfig(), argv), hostLanguage(readConfig().language, process.env)),
  relax: (argv) => changeSetting("relaxed", argv[1], flag(argv, "--why")),
  strict: (argv) => changeSetting("strict", argv[1], flag(argv, "--why")),
  off: (argv) => changeSetting("off", argv[1], flag(argv, "--why")),
  feedback: (argv) => {
    const config = readConfig();
    return runFeedback(positional(argv), argv, {
      cwd: process.cwd(),
      ui: hostLanguage(config.language, process.env),
      version: VERSION,
      runtime: `Node ${process.version} · ${process.platform} ${process.arch}`,
      flag,
      settingsOf: (ruleIds) => settingsOf(config, ruleIds),
      check: async (path) => ({
        ...(await inspectAll(config, argv)(path)).checked,
        conditions: runConditions(argv, flag(argv, "--genre"), config.experimental),
      }),
    });
  },
  skill: (argv) => runSkill(argv, { cwd: process.cwd(), home: homedir(), ui: hostLanguage(readConfig().language, process.env) }),
};

/** Every subcommand. Anything else on the command line is a file to check. */
export const COMMANDS: readonly string[] = Object.keys(HANDLERS);

export const main = async (argv: readonly string[]): Promise<number> => {
  const first = argv[0];
  if (first === undefined || first === "--help" || first === "-h") {
    console.log(hostText(readConfig()).usage);
    return first === undefined ? 1 : 0;
  }
  if (first === "--version" || first === "-v") {
    console.log(VERSION_LINES.join("\n"));
    return 0;
  }
  // 知らないジャンルではどの rule も当たらず、知らない文書の種類では種類の知識が外れる。どちらも素通りに見えるので、何かする前に止める。
  const config = readConfig();
  const problems = settingProblems(first, flag(argv, "--genre"), config, hostText(config), hostLanguage(config.language, process.env));
  problems.forEach((problem) => console.error(problem));
  if (problems.length > 0) return 1;
  const handler = HANDLERS[first];
  if (handler !== undefined) return handler(argv);
  const targets = targetsOf(first === "lint" ? argv.slice(1) : argv);
  return argv.includes("--watch") ? runWatch(targets, argv) : lint(targets, argv);
};
