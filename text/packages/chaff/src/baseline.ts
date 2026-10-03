import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { posix, relative, resolve, sep } from "node:path";
import type { Finding } from "./plugin.ts";

export const BASELINE_FILE = ".chaff-baseline.json";

/**
 * 行番号ではなく内容で同定する。前後に段落を 1 つ足しただけで棚上げが全部剥がれると、
 * baseline は使い物にならない。workflow spec §8。
 */
export const fingerprint = (path: string, finding: Finding): string => {
  const body = [path, finding.rule, finding.quote.replace(/\s+/gu, " ").trim()].join(" ");
  return createHash("sha256").update(body).digest("hex").slice(0, 16);
};

type PathRules = Pick<typeof posix, "relative" | "resolve" | "sep">;
const NATIVE: PathRules = { relative, resolve, sep };

/**
 * baseline が覚えるパス。baseline のフォルダからの相対で、区切りはどの OS でも「/」。
 * OS の区切りのまま覚えると、macOS で書いた baseline が Windows では何も棚上げしない。
 */
export const baselinePath = (path: string, folder: string, rules: PathRules = NATIVE): string =>
  rules.relative(folder, rules.resolve(folder, path)).split(rules.sep).join("/");

/**
 * findings の fingerprint を順に。一つの文から出た指摘は同じ文を引くので、文と rule の組ごとに一度だけ計算する。
 * 長い文に指摘が多いと、指摘ごとに文を読み直すのでは指摘数と文の長さの積になる。
 * folder は baseline を置くフォルダ。パスはそこからの相対にしてから数える。
 */
export const fingerprints = (path: string, findings: readonly Finding[], folder: string): string[] => {
  const key = baselinePath(path, folder);
  const known = new Map<string, Map<string, string>>();
  return findings.map((finding) => {
    const byRule = known.get(finding.quote) ?? new Map<string, string>();
    known.set(finding.quote, byRule);
    const found = byRule.get(finding.rule) ?? fingerprint(key, finding);
    byRule.set(finding.rule, found);
    return found;
  });
};

export type Baseline = { readonly version: 1; readonly created: string; readonly entries: readonly string[] };

const isBaseline = (value: unknown): value is Baseline =>
  typeof value === "object" &&
  value !== null &&
  "entries" in value &&
  Array.isArray(value.entries) &&
  value.entries.every((entry) => typeof entry === "string");

export const readBaseline = (path: string): Baseline | undefined => {
  if (!existsSync(path)) return undefined;
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return isBaseline(raw) ? raw : undefined;
};

export const writeBaseline = (path: string, entries: readonly string[]): void => {
  const sorted = entries.toSorted((left, right) => left.localeCompare(right, "en"));
  const body = { version: 1, created: new Date().toISOString().slice(0, 10), entries: sorted };
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
};

export type Split = { readonly fresh: readonly Finding[]; readonly shelved: number };

/** baseline にあるものは報告しない。新しく増えたものだけを出す。 */
export const splitByBaseline = (path: string, findings: readonly Finding[], baseline: Baseline | undefined, folder: string): Split => {
  if (baseline === undefined) return { fresh: findings, shelved: 0 };
  const known = new Set(baseline.entries);
  const prints = fingerprints(path, findings, folder);
  const fresh = findings.filter((_, index) => !known.has(prints[index] ?? ""));
  return { fresh, shelved: findings.length - fresh.length };
};

/** 直った分だけを落とす。増える方向には動かさない。 */
export const prune = (previous: Baseline, stillPresent: readonly string[]): string[] => {
  const present = new Set(stillPresent);
  return previous.entries.filter((entry) => present.has(entry));
};
