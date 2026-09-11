import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
  const sorted = [...entries].sort((left, right) => left.localeCompare(right, "en"));
  const body = { version: 1, created: new Date().toISOString().slice(0, 10), entries: sorted };
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
};

export type Split = { readonly fresh: readonly Finding[]; readonly shelved: number };

/** baseline にあるものは報告しない。新しく増えたものだけを出す。 */
export const splitByBaseline = (path: string, findings: readonly Finding[], baseline: Baseline | undefined): Split => {
  if (baseline === undefined) return { fresh: findings, shelved: 0 };
  const known = new Set(baseline.entries);
  const fresh = findings.filter((finding) => !known.has(fingerprint(path, finding)));
  return { fresh, shelved: findings.length - fresh.length };
};

/** 直った分だけを落とす。増える方向には動かさない。 */
export const prune = (previous: Baseline, stillPresent: readonly string[]): string[] => {
  const present = new Set(stillPresent);
  return previous.entries.filter((entry) => present.has(entry));
};
