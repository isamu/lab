import type { Finding, Sentence } from "../plugin.ts";

// What a plugin's detector returned, checked and turned into chaff's findings. Anything else than a list of
// { start, end?, values? } inside the document is refused as a whole, with what was wrong: a rule that half works
// would report some places and silently drop others. Pure.

export type ShapeProblem =
  | { readonly kind: "not-a-list"; readonly returned: string }
  | { readonly kind: "not-a-finding"; readonly index: number }
  | { readonly kind: "bad-start"; readonly index: number; readonly written: string }
  | { readonly kind: "bad-end"; readonly index: number; readonly written: string }
  | { readonly kind: "bad-values"; readonly index: number };

export type Returned = { readonly findings: readonly Finding[] } | { readonly problem: ShapeProblem };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** What came back instead of a list, in a few words: "a Promise", "undefined", "an object". */
export const describeValue = (value: unknown): string => {
  if (value === null || value === undefined) return String(value);
  if (value instanceof Promise) return "a Promise";
  if (Array.isArray(value)) return "a list";
  return typeof value === "object" ? "an object" : `a ${typeof value}`;
};

const isOffsetIn = (value: unknown, low: number, high: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= low && value <= high;

const isValue = (value: unknown): value is string | number => typeof value === "string" || (typeof value === "number" && Number.isFinite(value));

const printed = (value: unknown): string => JSON.stringify(value) ?? String(value);

/** The sentence the finding is in, or the line when it is in none (a heading, a table). */
const quoteAt = (source: string, sentences: readonly Sentence[], offset: number): string => {
  const sentence = sentences.find((entry) => entry.span.start <= offset && offset < entry.span.end);
  if (sentence !== undefined) return sentence.text.trim();
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const lineEnd = source.indexOf("\n", offset);
  return source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd).trim();
};

type Checked = { readonly finding: Finding } | { readonly problem: ShapeProblem };

const checkedFinding = (entry: unknown, index: number, source: string, sentences: readonly Sentence[]): Checked => {
  if (!isRecord(entry)) return { problem: { kind: "not-a-finding", index } };
  const { start, end = start, values = {} } = entry;
  if (!isOffsetIn(start, 0, source.length)) return { problem: { kind: "bad-start", index, written: printed(start) } };
  if (!isOffsetIn(end, start, source.length)) return { problem: { kind: "bad-end", index, written: printed(end) } };
  if (!isRecord(values) || !Object.values(values).every(isValue)) return { problem: { kind: "bad-values", index } };
  const filled = { matched: source.slice(start, end), ...values, offset: start };
  return { finding: { rule: "", severity: "warning", line: 0, column: 0, quote: quoteAt(source, sentences, start), values: filled } };
};

/** The findings a detector returned, placed in the document, or the first thing wrong with them. index counts from 1. */
export const returnedFindings = (returned: unknown, source: string, sentences: readonly Sentence[]): Returned => {
  if (!Array.isArray(returned)) return { problem: { kind: "not-a-list", returned: describeValue(returned) } };
  // Array.from reads a hole in a sparse list as undefined, so it is refused rather than skipped.
  const checked = Array.from(returned, (entry: unknown, at) => checkedFinding(entry, at + 1, source, sentences));
  const wrong = checked.find((entry) => "problem" in entry);
  if (wrong !== undefined && "problem" in wrong) return { problem: wrong.problem };
  return { findings: checked.flatMap((entry) => ("finding" in entry ? [entry.finding] : [])) };
};
