import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import type { Level, Severity } from "./plugin.ts";

export const CHECKS_FILE = "checks.yaml";

/**
 * 利用者が自然文で足す検査。キーは英語、中身は書き手の言葉。
 * プログラムは書かせない。spec §18.3。
 */
export type UserCheck = {
  readonly id: string;
  readonly name: string;
  readonly use_for: readonly string[];
  readonly check: string;
  readonly look_at: string | undefined;
  readonly level: Level;
  readonly how_to_fix: string;
  readonly source: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined => (typeof value === "string" ? value.trim() : undefined);

const LEVELS: readonly Level[] = ["strict", "normal", "relaxed", "off"];
const asLevel = (value: unknown): Level => LEVELS.find((level) => level === value) ?? "normal";

/** id は名前から作る。利用者に id を書かせない。 */
const idOf = (name: string, index: number): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  return slug.length > 0 ? `check:${slug}` : `check:${index + 1}`;
};

/** use_for は 1 つでも配列でも書ける。書かなければ全ジャンル。 */
const useForOf = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  return ["blog", "business"];
};

const toCheck = (raw: unknown, index: number, source: string): UserCheck | undefined => {
  if (!isRecord(raw)) return undefined;
  const name = str(raw["name"]);
  const check = str(raw["check"]);
  if (name === undefined || check === undefined) return undefined;
  return {
    id: idOf(name, index),
    name,
    use_for: useForOf(raw["use_for"]),
    check,
    look_at: str(raw["look_at"]),
    level: asLevel(raw["level"]),
    how_to_fix: str(raw["how_to_fix"]) ?? "",
    source,
  };
};

export const loadChecks = (path: string): UserCheck[] => {
  if (!existsSync(path)) return [];
  const raw: unknown = parse(readFileSync(path, "utf8"));
  if (!isRecord(raw) || !Array.isArray(raw["checks"])) return [];
  return raw["checks"].map((entry, index) => toCheck(entry, index, path)).filter((entry) => entry !== undefined);
};

/** 4 語を severity にする。L4 は件数ではなく深刻度を段で持つ。 */
export const severityOf = (level: Level): Severity => {
  if (level === "strict") return "error";
  if (level === "relaxed") return "info";
  return "warning";
};
