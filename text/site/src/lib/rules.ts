// The rule reference is built from chaff's own rule files, so it cannot say anything chaff does not ship.
import { parse } from "yaml";
import type { Lang } from "./i18n";

const LEVEL_NAMES: readonly string[] = ["strict", "normal", "relaxed"];

export type Localized = Record<Lang, string>;

export type Rule = {
  readonly id: string;
  readonly layer: string;
  readonly status: "stable" | "experimental";
  readonly severity: Localized;
  readonly languages: readonly Lang[];
  readonly name: Localized;
  readonly why: Localized;
  readonly message: Localized;
  readonly howToFix: Localized;
  readonly levels: Record<Lang, readonly (readonly [string, string])[]>;
  readonly useFor: readonly string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const localized = (value: unknown, file: string, field: string): Localized => {
  if (typeof value === "string") return { ja: value, en: value };
  if (isRecord(value) && typeof value["ja"] === "string" && typeof value["en"] === "string") return { ja: value["ja"], en: value["en"] };
  throw new Error(`${file}: ${field} must be a string or { ja, en }`);
};

const text = (value: unknown): string => (typeof value === "number" || typeof value === "string" ? String(value) : JSON.stringify(value));

/** One level's threshold as written: a number, a word, or one per language. */
const levelFor = (value: unknown, lang: Lang): string => (isRecord(value) && lang in value ? text(value[lang]) : text(value));

const levelsOf = (value: unknown): Rule["levels"] => {
  const entries = (lang: Lang): (readonly [string, string])[] =>
    isRecord(value)
      ? LEVEL_NAMES.filter((level) => level in value).map((level): readonly [string, string] => [level, levelFor(value[level], lang)])
      : [];
  return { ja: entries("ja"), en: entries("en") };
};

const ruleOf = (file: string, source: string): Rule => {
  const raw: unknown = parse(source);
  if (!isRecord(raw) || typeof raw["id"] !== "string" || typeof raw["layer"] !== "string") throw new Error(`${file}: not a rule`);
  const languages = Array.isArray(raw["languages"]) ? raw["languages"].filter((lang): lang is Lang => lang === "ja" || lang === "en") : [];
  return {
    id: raw["id"],
    layer: raw["layer"],
    status: raw["status"] === "stable" ? "stable" : "experimental",
    severity: localized(raw["severity"], file, "severity"),
    languages: languages.length > 0 ? languages : ["ja", "en"],
    name: localized(raw["name"], file, "name"),
    why: localized(raw["why"], file, "why"),
    message: localized(raw["message"], file, "message"),
    howToFix: localized(raw["how_to_fix"], file, "how_to_fix"),
    levels: levelsOf(raw["levels"]),
    useFor: Array.isArray(raw["use_for"]) ? raw["use_for"].map(String) : [],
  };
};

const files = import.meta.glob<string>("../../../packages/chaff/rules/*.yaml", { query: "?raw", import: "default", eager: true });

/** Every rule chaff ships, by layer and then by id. */
export const rules: readonly Rule[] = Object.entries(files)
  .map(([file, source]) => ruleOf(file, source))
  .sort((a, b) => a.layer.localeCompare(b.layer) || a.id.localeCompare(b.id));
