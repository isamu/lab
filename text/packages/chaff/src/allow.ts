import type { Finding } from "./plugin.ts";
import { matches } from "./config/by-path.ts";
import { boundedMatches } from "./custom/bounded-match.ts";
import { PatternTimeout } from "./custom/pattern-timeout.ts";
import { regexRefusal, type RegexRefusal } from "./custom/regex-safety.ts";
import { lineStarts } from "./position.ts";

/**
 * chaff.yaml's `allow:` — text a team never wants reported (a product name, a quoted form), each with the reason.
 * A finding placed inside an allowed occurrence is dropped and listed by `chaff suppressions` with that reason, as a
 * stet is: an allowance without a reason, or one that silences quietly, would let the rules drift from the documents.
 */
export type AllowEntry = {
  /** Where the entry is under allow: (allow[0]), for messages. */
  readonly at: string;
  /** A literal string (text:) or a regular expression (pattern:); exactly one is written. */
  readonly text?: string | undefined;
  readonly pattern?: string | undefined;
  readonly reason: string;
  /** Rule ids the entry covers; empty covers every rule. */
  readonly rules: readonly string[];
  /** Globs (from chaff.yaml's folder) of the files the entry covers; empty covers every file. */
  readonly files: readonly string[];
};

export type AllowProblem =
  | { readonly kind: "not-a-list"; readonly written: string }
  | { readonly kind: "not-a-map" | "no-reason" | "no-target" | "both-targets" | "bad-rules" | "bad-files"; readonly at: string }
  | { readonly kind: "bad-pattern"; readonly at: string; readonly refusal: RegexRefusal };

export type AllowRead = { readonly entries: readonly AllowEntry[]; readonly problems: readonly AllowProblem[] };

const PATTERN_FLAGS = "u";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const printed = (value: unknown): string => JSON.stringify(value) ?? String(value);

const nonEmpty = (value: unknown): string | undefined => (typeof value === "string" && value.trim() !== "" ? value : undefined);

/** A list of non-empty strings, or one string; undefined when written as anything else. Missing is the empty list. */
const stringsOf = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) return [];
  if (typeof value === "string") return value.trim() === "" ? undefined : [value.trim()];
  if (!Array.isArray(value)) return undefined;
  const items: unknown[] = value;
  const strings = items.flatMap((item) => (nonEmpty(item) === undefined ? [] : [String(item).trim()]));
  return strings.length === items.length ? strings : undefined;
};

/** The first thing wrong with one entry's target (text: or pattern:), or undefined. */
const targetProblem = (raw: Record<string, unknown>, at: string): AllowProblem | undefined => {
  const text = nonEmpty(raw["text"]);
  const pattern = nonEmpty(raw["pattern"]);
  if (text !== undefined && pattern !== undefined) return { kind: "both-targets", at };
  if (text === undefined && pattern === undefined) return { kind: "no-target", at };
  const refusal = pattern === undefined ? undefined : regexRefusal(pattern, PATTERN_FLAGS);
  return refusal === undefined ? undefined : { kind: "bad-pattern", at, refusal };
};

const entryOf = (raw: unknown, index: number): AllowEntry | AllowProblem => {
  const at = `allow[${String(index)}]`;
  if (!isRecord(raw)) return { kind: "not-a-map", at };
  const target = targetProblem(raw, at);
  if (target !== undefined) return target;
  const reason = nonEmpty(raw["reason"]);
  if (reason === undefined) return { kind: "no-reason", at };
  const rules = stringsOf(raw["rules"]);
  if (rules === undefined) return { kind: "bad-rules", at };
  const files = stringsOf(raw["files"]);
  if (files === undefined) return { kind: "bad-files", at };
  return { at, text: nonEmpty(raw["text"]), pattern: nonEmpty(raw["pattern"]), reason: reason.trim(), rules, files };
};

const isProblem = (value: AllowEntry | AllowProblem): value is AllowProblem => "kind" in value;

const isEntry = (value: AllowEntry | AllowProblem): value is AllowEntry => !isProblem(value);

/** chaff.yaml's allow: as written, read into entries and the problems that stop the run. Pure. */
export const allowOf = (raw: unknown): AllowRead => {
  if (raw === undefined || raw === null) return { entries: [], problems: [] };
  if (!Array.isArray(raw)) return { entries: [], problems: [{ kind: "not-a-list", written: printed(raw) }] };
  const items: unknown[] = raw;
  const read = items.map((item, index) => entryOf(item, index));
  return { entries: read.filter(isEntry), problems: read.filter(isProblem) };
};

/** The entries that cover this file. base is chaff.yaml's folder, as for by_path. */
export const allowFor = (entries: readonly AllowEntry[], base: string, path: string): AllowEntry[] =>
  entries.filter((entry) => entry.files.length === 0 || entry.files.some((glob) => matches(glob, base, path)));

type Range = { readonly start: number; readonly end: number };

const literalRanges = (source: string, text: string): Range[] => {
  const found: Range[] = [];
  for (let at = source.indexOf(text); at !== -1; at = source.indexOf(text, at + text.length)) found.push({ start: at, end: at + text.length });
  return found;
};

/** A pattern that runs past its time budget allows nothing: the findings stay, rather than vanish on a guess. */
const patternRanges = (source: string, pattern: string): Range[] => {
  try {
    return (boundedMatches(pattern, PATTERN_FLAGS, [source])[0] ?? []).map((match) => ({ start: match.index, end: match.index + match.text.length }));
  } catch (error) {
    if (error instanceof PatternTimeout) return [];
    throw error;
  }
};

const rangesOf = (source: string, entry: AllowEntry): Range[] =>
  entry.text !== undefined ? literalRanges(source, entry.text) : patternRanges(source, entry.pattern ?? "");

/** Where the finding is placed, as an offset into the source; undefined for a finding about the whole document. */
const offsetOf = (finding: Finding, starts: readonly number[]): number | undefined => {
  const offset = finding.values["offset"];
  if (typeof offset === "number") return offset;
  if (finding.line < 1 || finding.column < 1) return undefined;
  const lineStart = starts[finding.line - 1];
  return lineStart === undefined ? undefined : lineStart + finding.column - 1;
};

export type Allowed = { readonly finding: Finding; readonly entry: AllowEntry };

export type AllowApplied = { readonly kept: readonly Finding[]; readonly allowed: readonly Allowed[] };

/** Drops each finding placed inside an occurrence an entry allows for the finding's rule. entries are this file's (allowFor). */
export const applyAllow = (source: string, findings: readonly Finding[], entries: readonly AllowEntry[]): AllowApplied => {
  if (entries.length === 0 || findings.length === 0) return { kept: findings, allowed: [] };
  const starts = lineStarts(source);
  const ranged = entries.map((entry) => ({ entry, ranges: rangesOf(source, entry) }));
  const matched = findings.map((finding) => {
    const offset = offsetOf(finding, starts);
    const hit =
      offset === undefined
        ? undefined
        : ranged.find(
            ({ entry, ranges }) =>
              (entry.rules.length === 0 || entry.rules.includes(finding.rule)) && ranges.some((range) => offset >= range.start && offset < range.end),
          );
    return { finding, entry: hit?.entry };
  });
  return {
    kept: matched.filter((pair) => pair.entry === undefined).map((pair) => pair.finding),
    allowed: matched.flatMap((pair) => (pair.entry === undefined ? [] : [{ finding: pair.finding, entry: pair.entry }])),
  };
};
