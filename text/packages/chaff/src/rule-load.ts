import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import type { LevelTable, RuleDefinition, Severity } from "./plugin.ts";

const RULES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "rules");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isLocalized = (value: unknown): value is Record<string, string> => isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");

const SEVERITY_BY_NAME: Readonly<Record<string, number>> = { info: 1, warning: 2, error: 3 };

/** L4 は件数ではなく深刻度を段で持つ。error/warning/info を数に写して同じ器に入れる。 */
const asNumber = (entry: unknown): number | undefined => {
  if (typeof entry === "number") return entry;
  return typeof entry === "string" ? SEVERITY_BY_NAME[entry] : undefined;
};

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
  ...(isSeverity(raw["severity"]) ? [] : ["severity"]),
];

const localizedOf = (value: unknown): Record<string, string> => (isLocalized(value) ? value : {});

const stringList = (value: unknown): string[] | undefined => (Array.isArray(value) ? value.map((entry) => String(entry)) : undefined);

const toRule = (raw: unknown, language: string, file: string): RuleDefinition => {
  if (!isRecord(raw)) throw new Error(`${file}: rule は object であること`);
  const levels = flattenLevels(raw["levels"], language);
  const missing = missingFields(raw, levels);
  if (missing.length > 0) throw new Error(`${file}: 必須フィールドがありません: ${missing.join(", ")}`);
  if (levels === undefined) throw new Error(`${file}: levels を解決できません`);
  return {
    id: String(raw["id"]),
    layer: pick(raw["layer"], LAYERS) ?? "L1",
    status: pick(raw["status"], STATUSES) ?? "experimental",
    name: localizedOf(raw["name"]),
    why: localizedOf(raw["why"]),
    how_to_fix: localizedOf(raw["how_to_fix"]),
    message: localizedOf(raw["message"]),
    levels,
    by_genre: genreTables(raw["by_genre"], language),
    how_to_find: String(raw["how_to_find"]),
    word_list: typeof raw["word_list"] === "string" ? raw["word_list"] : undefined,
    what_to_check: isLocalized(raw["what_to_check"]) ? raw["what_to_check"] : undefined,
    where: typeof raw["where"] === "string" ? raw["where"] : undefined,
    requires: stringList(raw["requires"]) ?? [],
    languages: stringList(raw["languages"]),
    use_for: Array.isArray(raw["use_for"]) ? raw["use_for"].map((entry) => String(entry)) : [],
    severity: isSeverity(raw["severity"]) ? raw["severity"] : "warning",
  };
};

export const loadRules = (language: string, dir: string = RULES_DIR): RuleDefinition[] =>
  readdirSync(dir)
    .filter((file) => file.endsWith(".yaml"))
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((file) => toRule(parse(readFileSync(join(dir, file), "utf8")), language, file));
