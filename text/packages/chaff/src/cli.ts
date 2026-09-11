import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadAdapter, packageFor } from "./adapter-load.ts";
import { CONFIG_FILE, EMPTY, loadConfig, type Config } from "./config/load.ts";
import { applyLevel } from "./config/write.ts";
import { buildDocument } from "./document.ts";
import { guessLanguage } from "./detect.ts";
import { collectTargets } from "./files.ts";
import { frontMatterGenre, guessGenre } from "./genre.ts";
import { GENRES, runInit } from "./init.ts";
import { isLevel } from "./levels.ts";
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
  chaff init                     chaff.yaml を作る
  chaff explain <rule>           そのルールの意図と根拠を読む
  chaff genres                   ジャンルの一覧
  chaff rules --json             いまの設定を JSON で出す（AI に渡す用）
  chaff relax|strict|off <rule> [--why "理由"]

  --compact        エンジニア向けの 1 行形式
  --experimental   試験中の rule も動かす

値は strict / normal / relaxed / off の 4 つから選びます。
`;

const readConfig = (): Config => (existsSync(join(process.cwd(), CONFIG_FILE)) ? loadConfig(join(process.cwd(), CONFIG_FILE)) : EMPTY);

const resolveGenre = (path: string, source: string, config: Config): { genre: string; from: string } => {
  if (config.genre !== undefined) return { genre: config.genre, from: CONFIG_FILE };
  const guess = guessGenre(path, source, frontMatterGenre(source));
  return guess === undefined ? { genre: "blog/tech", from: "既定" } : { genre: guess.genre, from: guess.from };
};

const CHANGE: Readonly<Record<string, Level>> = { relax: "relaxed", strict: "strict", off: "off" };

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

const lintOne = async (path: string, config: Config, argv: readonly string[]): Promise<{ text: string; outcome: FileOutcome }> => {
  const source = await readFile(path, "utf8");
  const language = config.language ?? guessLanguage(source).language;
  const adapter = await loadAdapter(language);
  const { genre, from } = resolveGenre(path, source, config);
  const doc = buildDocument(path, source, adapter);
  const rules = loadRules(language);
  const result = runRules(doc, rules, config.rules, config.experimental || argv.includes("--experimental"), genre);
  const header = `${path}   ${genre} · ${language === "ja" ? "日本語" : "英語"}   ジャンルは${from}から`;
  const text = argv.includes("--compact") ? renderCompact(header, result, rules, language) : renderFriendly(header, result, rules, language);
  return { text, outcome: { path, findings: result.findings, notRun: result.skipped.length } };
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
  const results = await Promise.all(paths.map((path) => lintOne(path, config, argv)));
  results.filter((result) => result.outcome.findings.length > 0 || paths.length === 1).forEach((result) => console.log(result.text));
  renderSummary(results.map((result) => result.outcome)).forEach((line) => console.log(line));
  return results.some((result) => result.outcome.findings.some((finding) => finding.severity === "error")) ? 1 : 0;
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
  if (ruleId !== "max-sentence-length") return "回";
  return language === "ja" ? "文字" : "語";
};

const COMMANDS = new Set(["init", "genres", "explain", "rules", "relax", "strict", "off"]);

export const main = async (argv: readonly string[]): Promise<number> => {
  const first = argv[0];
  if (first === undefined || first === "--help" || first === "-h") {
    console.log(USAGE);
    return first === undefined ? 1 : 0;
  }
  if (first === "init") {
    runInit(process.cwd(), flag(argv, "--genre") ?? "blog/tech").forEach((line) => console.log(line));
    return 0;
  }
  if (first === "genres") {
    console.log(
      ["", "  使えるジャンル:", ...GENRES.map((genre) => `    ${genre}`), "", "  chaff.yaml の genre に書くか、--genre で指定します。", ""].join("\n"),
    );
    return 0;
  }
  if (first === "explain") return explain(argv[1]);
  if (first === "rules") {
    const config = readConfig();
    const language = config.language ?? "ja";
    console.log(rulesJson(loadRules(language), config, language, config.genre ?? "blog/tech"));
    return 0;
  }
  const change = CHANGE[first];
  if (change !== undefined && isLevel(change)) return changeSetting(change, argv[1], flag(argv, "--why"));
  const targets = (first === "lint" ? argv.slice(1) : argv).filter((arg) => !arg.startsWith("--") && !COMMANDS.has(arg));
  return lint(targets, argv);
};
