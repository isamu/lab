import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadAdapter, packageFor } from "./adapter-load.ts";
import { CONFIG_FILE, EMPTY, loadConfig, type Config } from "./config/load.ts";
import { applyByPath } from "./config/by-path.ts";
import { applyLevel } from "./config/write.ts";
import { buildDocument } from "./document.ts";
import { guessLanguage } from "./detect.ts";
import { collectTargets } from "./files.ts";
import { BASELINE_FILE, fingerprint, readBaseline, splitByBaseline, writeBaseline } from "./baseline.ts";
import { applySuppressions } from "./stet.ts";
import { renderSuppressions, type PerFile } from "./render/suppressions.ts";
import { clock, describeChange, snapshotOf, watchPaths, type Snapshot } from "./watch.ts";
import { runEval } from "./commands/eval.ts";
import { runTest } from "./commands/test.ts";
import { frontMatterGenre, guessGenre } from "./genre.ts";
import { GENRES, runInit } from "./init.ts";
import { loadRules } from "./rule-load.ts";
import { renderCompact } from "./render/compact.ts";
import { renderExplain } from "./render/explain.ts";
import { renderFriendly } from "./render/friendly.ts";
import { rulesJson } from "./render/rules-json.ts";
import { renderSummary, type FileOutcome } from "./render/summary.ts";
import { runRules } from "./run.ts";
import type { Level, RuleDefinition } from "./plugin.ts";

const USAGE = `chaff — 文章の読みにくいところを見つけます。文章は書き換えません。

  chaff <file|dir|glob>...       検査する（設定も API key も要りません）
  chaff .                        この場所の Markdown を全部
  chaff test <file|dir>...       意味を読む検査も動かす（API key が要ります）
  chaff init                     chaff.yaml を作る
  chaff eval <dir>               手元の文書で閾値を測り直す
  chaff explain <rule>           そのルールの意図と根拠を読む
  chaff genres                   ジャンルの一覧
  chaff rules --json             いまの設定を JSON で出す（AI に渡す用）
  chaff baseline <dir>           いまある指摘を棚上げする（既存の repo に入れるとき）
  chaff suppressions <dir>       stet で黙らせている指摘を数える
  chaff relax|strict|off <rule> [--why "理由"]

  --compact         エンジニア向けの 1 行形式
  --experimental    試験中の rule も動かす
  --show-baseline   棚上げした分も含めて全部見る
  --watch           保存のたびに見直し、変わったところだけ出す

この箇所だけ黙らせる:  <!-- stet: rule-id — 理由 -->

値は strict / normal / relaxed / off の 4 つから選びます。
`;

const readConfig = (): Config => (existsSync(join(process.cwd(), CONFIG_FILE)) ? loadConfig(join(process.cwd(), CONFIG_FILE)) : EMPTY);

const resolveGenre = (path: string, source: string, config: Config): { genre: string; from: string } => {
  // パスごとの上書きが最優先。「全体はこう、ここだけは違う」を書けるようにする。
  const override = applyByPath(config.byPath, config.baseDir, path);
  if (override.genre !== undefined) return { genre: override.genre, from: `${CONFIG_FILE} の by_path` };
  if (config.genre !== undefined) return { genre: config.genre, from: CONFIG_FILE };
  const guess = guessGenre(path, source, frontMatterGenre(source));
  return guess === undefined ? { genre: "blog/tech", from: "既定" } : { genre: guess.genre, from: guess.from };
};

const findRule = (rules: readonly RuleDefinition[], id: string | undefined): RuleDefinition | undefined => rules.find((rule) => rule.id === id);

const changeSetting = (command: Level, ruleId: string | undefined, why: string | undefined): number => {
  const config = readConfig();
  const rule = findRule(loadRules(config.language ?? "ja"), ruleId);
  if (rule === undefined) {
    console.error(`${ruleId ?? "(名前なし)"} というルールはありません。npx chaff rules --json で一覧が出ます。`);
    return 1;
  }
  const outcome = applyLevel(join(process.cwd(), CONFIG_FILE), rule, command, why, config.language ?? "ja", process.env["USER"] ?? "unknown");
  console.log(outcome.message);
  return outcome.ok ? 0 : 1;
};

const flag = (argv: readonly string[], name: string): string | undefined => {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
};

type Inspected = { readonly text: string; readonly outcome: FileOutcome; readonly perFile: PerFile; readonly all: readonly string[] };

const headerFor = (path: string, genre: string, from: string, language: string, shelved: number, hushed: number): string => {
  const shelf = shelved > 0 ? `   棚上げ ${shelved} 件` : "";
  const stet = hushed > 0 ? `   stet ${hushed} 件` : "";
  return `${path}   ${genre} \u00b7 ${language === "ja" ? "日本語" : "英語"}   ジャンルは${from}から${shelf}${stet}`;
};

const inspect = async (path: string, config: Config, argv: readonly string[]): Promise<Inspected> => {
  const source = await readFile(path, "utf8");
  const language = applyByPath(config.byPath, config.baseDir, path).language ?? config.language ?? guessLanguage(source).language;
  const adapter = await loadAdapter(language);
  const { genre, from } = resolveGenre(path, source, config);
  const doc = buildDocument(path, source, adapter);
  const rules = loadRules(language);
  const raw = runRules(doc, rules, config.rules, config.experimental || argv.includes("--experimental"), genre);
  // 応答は 3 つ。stet で黙らせたものは、ここで落とす。
  const applied = applySuppressions(
    source,
    raw.findings,
    doc.sections.map((section) => section.span),
  );
  const baseline = argv.includes("--show-baseline") ? undefined : readBaseline(join(process.cwd(), BASELINE_FILE));
  const split = splitByBaseline(path, applied.kept, baseline);
  const result = { ...raw, findings: split.fresh };
  const header = headerFor(path, genre, from, language, split.shelved, applied.suppressed.length);
  const text = argv.includes("--compact") ? renderCompact(header, result, rules, language) : renderFriendly(header, result, rules, language);
  return {
    text,
    outcome: { path, findings: split.fresh, notRun: raw.skipped.length },
    perFile: { path, suppressed: applied.suppressed, reasonless: applied.unusedReasonless },
    all: applied.kept.map((finding) => fingerprint(path, finding)),
  };
};

const lint = async (targets: readonly string[], argv: readonly string[]): Promise<number> => {
  const paths = collectTargets(targets);
  if (paths.length === 0) {
    // 0 件を成功にすると「CI は通っているが何も検証していない」状態が続く。§14。
    console.error(`Markdown が 1 つも見つかりませんでした: ${targets.join(", ")}`);
    return 1;
  }
  const config = readConfig();
  const language = config.language ?? "ja";
  if (packageFor(language) === undefined) {
    console.error(`言語 "${language}" のアダプタがありません。`);
    return 1;
  }
  const results = await Promise.all(paths.map((path) => inspect(path, config, argv)));
  results.filter((result) => result.outcome.findings.length > 0 || paths.length === 1).forEach((result) => console.log(result.text));
  renderSummary(results.map((result) => result.outcome)).forEach((line) => console.log(line));
  return results.some((result) => result.outcome.findings.some((finding) => finding.severity === "error")) ? 1 : 0;
};

/**
 * 書いている最中は、全件を出し直されても何が変わったのか分からない。
 * 差分だけを出す。workflow spec §11。
 */
const runWatch = async (targets: readonly string[], argv: readonly string[]): Promise<number> => {
  const paths = collectTargets(targets);
  if (paths.length === 0) {
    console.error(`Markdown が 1 つも見つかりませんでした: ${targets.join(", ")}`);
    return 1;
  }
  const config = readConfig();
  const seen = new Map<string, Snapshot>();
  const once = async (path: string, first: boolean): Promise<void> => {
    const result = await inspect(path, config, argv);
    const after = snapshotOf(result.outcome.findings);
    const before = seen.get(path) ?? {};
    seen.set(path, after);
    if (first) return;
    const change = describeChange(before, after);
    console.log(`${clock()}  ${path}  ${change ?? "変わりませんでした"}`);
  };
  await Promise.all(paths.map((path) => once(path, true)));
  const totals = [...seen.values()].reduce((sum, snapshot) => sum + Object.values(snapshot).reduce((inner, count) => inner + count, 0), 0);
  console.log(`\n  ${paths.length} ファイルを見ています。いまの指摘は ${totals} 件です。`);
  console.log("  保存するたびに、変わったところだけ出します。止めるには Ctrl-C。\n");
  const stop = watchPaths(paths, (path) => void once(path, false));
  process.on("SIGINT", () => {
    stop();
    process.exit(0);
  });
  return new Promise(() => undefined);
};

const explain = (ruleId: string | undefined): number => {
  const config = readConfig();
  const language = config.language ?? "ja";
  const rules = loadRules(language);
  const rule = findRule(rules, ruleId);
  if (rule === undefined) {
    const list = rules.map((entry) => `  ${entry.id}`).join("\n");
    console.error(`${ruleId ?? "(名前なし)"} というルールはありません。\n一覧:\n${list}`);
    return 1;
  }
  const current = config.rules[rule.id] ?? (rule.status === "experimental" && !config.experimental ? "off" : "normal");
  console.log(renderExplain(rule, current, language, unitOf(rule.id, language)));
  return 0;
};

/** 閾値の単位。explain で「4 とは何の 4 か」を示すため。 */
const unitOf = (ruleId: string, language: string): string => {
  if (ruleId === "bold-density") return "1000 字あたりの箇所数";
  if (ruleId !== "max-sentence-length") return "回";
  return language === "ja" ? "文字" : "語";
};

const runBaseline = async (targets: readonly string[], argv: readonly string[]): Promise<number> => {
  const paths = collectTargets(targets.length > 0 ? targets : ["."]);
  if (paths.length === 0) {
    console.error("Markdown が 1 つも見つかりませんでした。");
    return 1;
  }
  const config = readConfig();
  const results = await Promise.all(paths.map((path) => inspect(path, config, [...argv, "--show-baseline"])));
  const entries = results.flatMap((result) => result.all);
  const file = join(process.cwd(), BASELINE_FILE);
  writeBaseline(file, entries);
  console.log(
    [
      "",
      `  ${paths.length} ファイルを走査しました。`,
      "",
      `  ${entries.length} 件の指摘を ${BASELINE_FILE} に記録しました。`,
      "  以後、これらは報告されません。新しく増えたものだけが出ます。",
      "",
      `  ${BASELINE_FILE} を commit してください。`,
      "",
    ].join("\n"),
  );
  return 0;
};

const runSuppressions = async (targets: readonly string[], argv: readonly string[]): Promise<number> => {
  const paths = collectTargets(targets.length > 0 ? targets : ["."]);
  const config = readConfig();
  const results = await Promise.all(paths.map((path) => inspect(path, config, [...argv, "--show-baseline"])));
  console.log(renderSuppressions(results.map((result) => result.perFile)));
  return 0;
};

type Handler = (argv: readonly string[]) => number | Promise<number>;

/** `--` で始まらない引数。対象のパス。 */
const positional = (argv: readonly string[]): string[] => argv.slice(1).filter((arg) => !arg.startsWith("--"));

const showRules = (): number => {
  const config = readConfig();
  const language = config.language ?? "ja";
  console.log(rulesJson(loadRules(language), config, language, config.genre ?? "blog/tech"));
  return 0;
};

const showGenres = (): number => {
  console.log(["", "  使えるジャンル:", ...GENRES.map((genre) => `    ${genre}`), "", "  chaff.yaml の genre に書くか、--genre で指定します。", ""].join("\n"));
  return 0;
};

/** 分岐を数珠つなぎにせず表にする。足すときに main を太らせない。 */
const HANDLERS: Readonly<Record<string, Handler>> = {
  init: (argv) => {
    runInit(process.cwd(), flag(argv, "--genre") ?? "blog/tech").forEach((line) => console.log(line));
    return 0;
  },
  genres: showGenres,
  rules: showRules,
  explain: (argv) => explain(argv[1]),
  eval: (argv) => runEval(positional(argv), argv, { config: readConfig(), resolveGenre, flag }),
  test: (argv) => runTest(positional(argv), argv, { config: readConfig(), resolveGenre, inspect }),
  baseline: (argv) => runBaseline(positional(argv), argv),
  suppressions: (argv) => runSuppressions(positional(argv), argv),
  relax: (argv) => changeSetting("relaxed", argv[1], flag(argv, "--why")),
  strict: (argv) => changeSetting("strict", argv[1], flag(argv, "--why")),
  off: (argv) => changeSetting("off", argv[1], flag(argv, "--why")),
};

export const main = async (argv: readonly string[]): Promise<number> => {
  const first = argv[0];
  if (first === undefined || first === "--help" || first === "-h") {
    console.log(USAGE);
    return first === undefined ? 1 : 0;
  }
  const handler = HANDLERS[first];
  if (handler !== undefined) return handler(argv);
  const targets = (first === "lint" ? argv.slice(1) : argv).filter((arg) => !arg.startsWith("--"));
  return argv.includes("--watch") ? runWatch(targets, argv) : lint(targets, argv);
};
