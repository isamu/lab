import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import type { LanguageLevels, LevelSets, LevelTable, RuleDefinition, Severity } from "./plugin.ts";
import { rankOfSeverity, severityAt } from "./levels.ts";
import { optionsOf } from "./rule-options.ts";
import { ruleGuideOf } from "./rule-guide.ts";
import { fieldProblemSentence, fieldProblems } from "./rule-fields.ts";
import { genresBeside } from "./known-genres.ts";

const RULES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "rules");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isLocalized = (value: unknown): value is Record<string, string> => isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");

/** 数えるものの無い rule（L4、番号の抜け）は件数ではなく重さを段で持つ。error/warning/info を数に写して同じ器に入れる。 */
const asNumber = (entry: unknown): number | undefined => (typeof entry === "number" ? entry : rankOfSeverity(entry));

const isLevelTable = (value: unknown): value is LevelTable =>
  isRecord(value) && Object.entries(value).every(([key, entry]) => ["strict", "normal", "relaxed"].includes(key) && asNumber(entry) !== undefined);

/** 言語別の levels を、その言語のぶんだけに平坦化する。単位が言語で違う rule のため。 */
const normalize = (table: LevelTable): LevelTable => Object.fromEntries(Object.entries(table).map(([key, entry]) => [key, asNumber(entry) ?? 0]));

const flattenLevels = (raw: unknown, language: string): LevelTable | undefined => {
  if (isLevelTable(raw)) return normalize(raw);
  if (!isRecord(raw)) return undefined;
  const forLanguage = raw[language] ?? raw["default"];
  return isLevelTable(forLanguage) ? normalize(forLanguage) : undefined;
};

/** ジャンル別の上書きも、言語別の levels と同じ形で書ける。読めないものは黙って落とさず捨てる。 */
const genreTables = (raw: unknown, language: string): Readonly<Record<string, LevelTable>> => {
  if (!isRecord(raw)) return {};
  const entries = Object.entries(raw).flatMap(([genre, table]) => {
    const flattened = flattenLevels(table, language);
    return flattened === undefined ? [] : [[genre, flattened] as const];
  });
  return Object.fromEntries(entries);
};

/** levels を言語別に書いた rule の、loaded 以外の言語の段。言語で分けていない rule は空。 */
const otherLanguages = (raw: Record<string, unknown>, loaded: string): Record<string, LanguageLevels> => {
  const levels = raw["levels"];
  if (!isRecord(levels) || isLevelTable(levels)) return {};
  return Object.fromEntries(
    Object.keys(levels)
      .filter((language) => language !== loaded && language !== "default")
      .flatMap((language) => {
        const table = flattenLevels(levels, language);
        return table === undefined ? [] : [[language, { levels: table, by_genre: genreTables(raw["by_genre"], language) }] as const];
      }),
  );
};

const SEVERITIES: readonly Severity[] = ["error", "warning", "info"];
const isSeverity = (value: unknown): value is Severity => SEVERITIES.some((entry) => entry === value);

const LAYERS = ["L1", "L2", "L3", "L4"] as const;
const STATUSES = ["experimental", "stable", "deprecated"] as const;

const pick = <T>(value: unknown, allowed: readonly T[]): T | undefined => allowed.find((entry) => entry === value);

/**
 * 必須フィールドが欠けた rule は読み込まない。spec §18.2。
 * message だけでは、非エンジニアは何が悪いのか分からない。why と how_to_fix を必須にする。
 */
const REQUIRED_TEXT = ["name", "why", "how_to_fix", "message"] as const;

const missingFields = (raw: Record<string, unknown>, levels: LevelTable | undefined): string[] => [
  ...(typeof raw["id"] === "string" ? [] : ["id"]),
  ...(pick(raw["layer"], LAYERS) === undefined ? ["layer"] : []),
  ...(pick(raw["status"], STATUSES) === undefined ? ["status"] : []),
  ...REQUIRED_TEXT.filter((field) => !isLocalized(raw[field])),
  ...(levels?.normal === undefined ? ["levels.normal"] : []),
  ...(typeof raw["how_to_find"] === "string" ? [] : ["how_to_find"]),
  ...(Array.isArray(raw["use_for"]) ? [] : ["use_for"]),
  ...(isSeverity(raw["severity"]) || isRecord(raw["severity"]) ? [] : ["severity"]),
];

const localizedOf = (value: unknown): Record<string, string> => (isLocalized(value) ? value : {});

/** 見つけ方ごとの message、置き場所ごとの読みかた。読めないものは捨てる。 */
const localizedByKey = (value: unknown): Record<string, Record<string, string>> =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).flatMap(([variant, text]) => (isLocalized(text) ? [[variant, text]] : []))) : {};

/**
 * severity も言語別に書ける。levels と同じ畳みかた。
 * 記号の許容度は言語で大きく違う（ダッシュは英語では普通、日本語の組版では扱いが難しい）。
 */
const severityOf = (raw: unknown, language: string): Severity => {
  if (isSeverity(raw)) return raw;
  if (!isRecord(raw)) return "warning";
  const picked: unknown = raw[language] ?? raw["default"];
  return isSeverity(picked) ? picked : "warning";
};

/** 言語で単位が違う数（日本語は文字、英語は語）。その言語のぶんだけを取る。無い言語では undefined。 */
const numberFor = (raw: unknown, language: string): number | undefined => {
  if (typeof raw === "number") return raw;
  const picked: unknown = isRecord(raw) ? (raw[language] ?? raw["default"]) : undefined;
  return typeof picked === "number" ? picked : undefined;
};

const stringList = (value: unknown): string[] | undefined => (Array.isArray(value) ? value.map((entry) => String(entry)) : undefined);

/** What only some rules declare: options beyond the level, and token features the adapter computes on request. */
const extrasOf = (raw: Record<string, unknown>, file: string): Pick<RuleDefinition, "options" | "token_features"> => ({
  ...(raw["options"] === undefined ? {} : { options: optionsOf(raw["options"], file) }),
  ...(raw["token_features"] === undefined ? {} : { token_features: stringList(raw["token_features"]) ?? [] }),
});

/** The table flattenLevels reads, before its severities become numbers. */
const writtenTable = (raw: unknown, language: string): unknown => {
  if (isLevelTable(raw) || !isRecord(raw)) return raw;
  return raw[language] ?? raw["default"];
};

/** Every level value written for a language: the rule's own table and each genre's. */
const writtenValues = (raw: Record<string, unknown>, language: string): unknown[] => {
  const genres = isRecord(raw["by_genre"]) ? Object.values(raw["by_genre"]) : [];
  return [raw["levels"], ...genres].flatMap((written) => {
    const table = writtenTable(written, language);
    return isRecord(table) ? Object.values(table) : [];
  });
};

/** Levels written as severities set the severity; a rule that mixes the two would say both. */
const levelSetsOf = (raw: Record<string, unknown>, language: string, file: string): LevelSets => {
  const values = writtenValues(raw, language);
  const severities = values.filter((value) => typeof value === "string").length;
  if (severities === 0) return "limit";
  if (severities < values.length) throw new Error(`${file}: levels と by_genre に重さ（error / warning / info）と数を混ぜて書けません`);
  // A genre's table would give the rule a default severity other than its severity field.
  if (isRecord(raw["by_genre"])) throw new Error(`${file}: 重さを段に持つ rule は by_genre を持てません`);
  return "severity";
};

/** severity は normal の段の重さそのもの。食い違うと、段を書かないときと normal と書いたときで重さが変わる。 */
const checkedSeverity = (rule: RuleDefinition, file: string): RuleDefinition => {
  if (rule.level_sets === "limit" || severityAt(rule, "normal") === rule.severity) return rule;
  throw new Error(`${file}: severity ${rule.severity} が levels の normal（${severityAt(rule, "normal")}）と違います`);
};

const toRule = (raw: unknown, language: string, file: string, genres: readonly string[]): RuleDefinition => {
  if (!isRecord(raw)) throw new Error(`${file}: rule は object であること`);
  const levels = flattenLevels(raw["levels"], language);
  const missing = missingFields(raw, levels);
  if (missing.length > 0) throw new Error(`${file}: 必須フィールドがありません: ${missing.join(", ")}`);
  if (levels === undefined) throw new Error(`${file}: levels を解決できません`);
  const [problem] = fieldProblems(raw, genres);
  if (problem !== undefined) throw new Error(`${file}: ${fieldProblemSentence(problem, "ja")}`);
  return checkedSeverity(ruleOf(raw, levels, levelSetsOf(raw, language, file), language, file), file);
};

const ruleOf = (raw: Record<string, unknown>, levels: LevelTable, levelSets: LevelSets, language: string, file: string): RuleDefinition => ({
  id: String(raw["id"]),
  layer: pick(raw["layer"], LAYERS) ?? "L1",
  status: pick(raw["status"], STATUSES) ?? "experimental",
  name: localizedOf(raw["name"]),
  why: localizedOf(raw["why"]),
  how_to_fix: localizedOf(raw["how_to_fix"]),
  message: localizedOf(raw["message"]),
  messages: localizedByKey(raw["messages"]),
  placeholders: localizedByKey(raw["placeholders"]),
  levels,
  level_sets: levelSets,
  by_genre: genreTables(raw["by_genre"], language),
  other_languages: otherLanguages(raw, language),
  how_to_find: String(raw["how_to_find"]),
  word_list: typeof raw["word_list"] === "string" ? raw["word_list"] : undefined,
  extra_word_lists: stringList(raw["extra_word_lists"]) ?? [],
  what_to_check: isLocalized(raw["what_to_check"]) ? raw["what_to_check"] : undefined,
  where: typeof raw["where"] === "string" ? raw["where"] : undefined,
  full_sentence: numberFor(raw["full_sentence"], language),
  requires: stringList(raw["requires"]) ?? [],
  uses: stringList(raw["uses"]) ?? [],
  from: stringList(raw["from"]) ?? [],
  languages: stringList(raw["languages"]),
  use_for: Array.isArray(raw["use_for"]) ? raw["use_for"].map((entry) => String(entry)) : [],
  severity: severityOf(raw["severity"], language),
  ...extrasOf(raw, file),
  guide: ruleGuideOf(raw),
});

/**
 * 読めない rule ファイルは、どれが何で読めないかを言う。
 * yaml の例外をそのまま投げると、スタックトレースだけが出てファイル名が出ない。
 */
const parseRule = (dir: string, file: string): unknown => {
  try {
    return parse(readFileSync(join(dir, file), "utf8"));
  } catch (error) {
    throw new Error(`${file} を読めません: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`, { cause: error });
  }
};

export const loadRules = (language: string, dir: string = RULES_DIR): RuleDefinition[] => {
  const genres = genresBeside(dir);
  return readdirSync(dir)
    .filter((file) => file.endsWith(".yaml"))
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .map((file) => toRule(parseRule(dir, file), language, file, genres));
};
