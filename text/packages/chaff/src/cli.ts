import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadAdapter, packageFor } from "./adapter-load.ts";
import { CONFIG_FILE, EMPTY, loadConfig, type Config } from "./config/load.ts";
import { applyLevel } from "./config/write.ts";
import { buildDocument } from "./document.ts";
import { guessLanguage } from "./detect.ts";
import { frontMatterGenre, guessGenre } from "./genre.ts";
import { isLevel } from "./levels.ts";
import { loadRules } from "./rule-load.ts";
import { renderCompact } from "./render/compact.ts";
import { renderFriendly } from "./render/friendly.ts";
import { rulesJson } from "./render/rules-json.ts";
import { runRules } from "./run.ts";
import type { Level } from "./plugin.ts";

const USAGE = `chaff — 文章の読みにくいところを見つけます。文章は書き換えません。

  chaff <file>                     検査する（設定も API key も要りません）
  chaff <file> --compact           エンジニア向けの 1 行形式
  chaff <file> --experimental      試験中の rule も動かす
  chaff rules --json               いまの設定を JSON で出す（AI に渡す用）
  chaff relax|strict|off <rule> [--why "理由"]

値は strict / normal / relaxed / off の 4 つから選びます。
`;

const readConfig = (): Config => (existsSync(join(process.cwd(), CONFIG_FILE)) ? loadConfig(join(process.cwd(), CONFIG_FILE)) : EMPTY);

const resolveGenre = (path: string, source: string, config: Config): { genre: string; from: string } => {
  if (config.genre !== undefined) return { genre: config.genre, from: CONFIG_FILE };
  const guess = guessGenre(path, source, frontMatterGenre(source));
  return guess === undefined ? { genre: "blog/tech", from: "既定" } : { genre: guess.genre, from: guess.from };
};

const CHANGE: Readonly<Record<string, Level>> = { relax: "relaxed", strict: "strict", off: "off" };

const changeSetting = (command: Level, ruleId: string | undefined, why: string | undefined): number => {
  if (ruleId === undefined) {
    console.error("ルール名を指定してください。例: npx chaff relax bold-density");
    return 1;
  }
  const config = readConfig();
  const rule = loadRules(config.language ?? "ja").find((entry) => entry.id === ruleId);
  if (rule === undefined) {
    console.error(`${ruleId} というルールはありません。npx chaff rules --json で一覧が出ます。`);
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

const lint = async (path: string, argv: readonly string[]): Promise<number> => {
  const source = await readFile(path, "utf8");
  const config = readConfig();
  const language = config.language ?? guessLanguage(source).language;
  if (packageFor(language) === undefined) {
    console.error(`言語 "${language}" のアダプタがありません。`);
    return 1;
  }
  const adapter = await loadAdapter(language);
  const { genre, from } = resolveGenre(path, source, config);
  const doc = buildDocument(path, source, adapter);
  const rules = loadRules(language);
  const result = runRules(doc, rules, config.rules, config.experimental || argv.includes("--experimental"), genre);
  const header = `${path}   ${genre} · ${language === "ja" ? "日本語" : "英語"}   ジャンルは${from}から`;
  console.log(argv.includes("--compact") ? renderCompact(header, result, rules, language) : renderFriendly(header, result, rules, language));
  return result.findings.some((finding) => finding.severity === "error") ? 1 : 0;
};

export const main = async (argv: readonly string[]): Promise<number> => {
  const first = argv[0];
  if (first === undefined || first === "--help" || first === "-h") {
    console.log(USAGE);
    return first === undefined ? 1 : 0;
  }
  if (first === "rules") {
    const config = readConfig();
    const language = config.language ?? "ja";
    console.log(rulesJson(loadRules(language), config, language, config.genre ?? "blog/tech"));
    return 0;
  }
  const change = CHANGE[first];
  if (change !== undefined && isLevel(change)) return changeSetting(change, argv[1], flag(argv, "--why"));
  return lint(first === "lint" ? (argv[1] ?? "") : first, argv);
};
