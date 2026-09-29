// The corpus documents of every kind (not the statutes): where each one lives, and the per-rule summary that
// `yarn corpus` compares with the committed expectation. Pure; the scripts read and write the files.
import { join } from "node:path";
import { congressionalRecordToMarkdown } from "./congressional-record-markdown.ts";
import { googlePatentsToMarkdown } from "./google-patents-markdown.ts";
import { htmlToMarkdown } from "./html-markdown.ts";
import { kokkaiToMarkdown } from "./kokkai-markdown.ts";
import { wikitextToMarkdown } from "./wikitext-markdown.ts";

/** A source that is not Markdown or plain text, and the converter that turns it into Markdown when it is fetched. */
const CONVERTERS = {
  wikitext: wikitextToMarkdown,
  html: htmlToMarkdown,
  "google-patents": googlePatentsToMarkdown,
  kokkai: kokkaiToMarkdown,
  "congressional-record": congressionalRecordToMarkdown,
} as const;

type SourceFormat = keyof typeof CONVERTERS;

export type DocEntry = {
  readonly id: string;
  readonly title: string;
  readonly genre: string;
  readonly language: string;
  readonly url: string;
  readonly license: string;
  /** May the text be committed? If not, only the URL is kept and the text is fetched into the cache. */
  readonly redistribute: boolean;
  readonly format?: SourceFormat;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const TEXT_FIELDS = ["id", "title", "genre", "language", "url", "license"] as const;

const isDocEntry = (value: unknown): value is DocEntry =>
  isRecord(value) &&
  value["source"] === "url" &&
  TEXT_FIELDS.every((field) => typeof value[field] === "string" && value[field] !== "") &&
  typeof value["redistribute"] === "boolean" &&
  (value["format"] === undefined || (typeof value["format"] === "string" && Object.hasOwn(CONVERTERS, value["format"])));

export const docEntries = (manifest: unknown): DocEntry[] =>
  isRecord(manifest) && Array.isArray(manifest["documents"]) ? manifest["documents"].filter(isDocEntry) : [];

/** What is stored for a fetched document: the text as fetched, or converted to Markdown when it has a format. */
export const storedText = (entry: DocEntry, fetched: string): string => (entry.format === undefined ? fetched : CONVERTERS[entry.format](fetched));

const isPlainText = (entry: DocEntry): boolean => new URL(entry.url).pathname.endsWith(".txt");

/**
 * Committed documents live in docs/, the others in the git-ignored .cache/. A Markdown source is stored as .source,
 * not .md, so that `chaff .` over this repository does not lint someone else's document as ours.
 */
export const docPath = (corpus: string, entry: DocEntry): string =>
  join(corpus, entry.redistribute ? "docs" : ".cache", `${entry.id}${isPlainText(entry) ? ".txt" : ".source"}`);

/** The name chaff reads the document under: a plain-text source (an RFC) as text, anything else as Markdown. */
export const parsedAs = (entry: DocEntry): string => `${entry.id}${isPlainText(entry) ? ".txt" : ".md"}`;

/** "id  rule 2, other-rule 1" with rules in id order, or "id  clean". */
export const summaryLine = (id: string, rules: readonly string[]): string => {
  const counts = rules.reduce<Map<string, number>>((acc, rule) => acc.set(rule, (acc.get(rule) ?? 0) + 1), new Map());
  const parts = [...counts.entries()].toSorted(([left], [right]) => left.localeCompare(right)).map(([rule, count]) => `${rule} ${String(count)}`);
  return `${id}  ${parts.length === 0 ? "clean" : parts.join(", ")}`;
};

const idOf = (line: string): string => line.split("  ")[0] ?? "";

/**
 * The lines of actual that differ from expected, as "- expected" / "+ actual" pairs, and the expected lines of
 * documents no longer in the manifest (known). Documents that were not fetched (absent from actual) are not compared.
 */
export const summaryChanges = (expected: readonly string[], actual: readonly string[], known: ReadonlySet<string>): string[] => {
  const before = new Map(expected.map((line) => [idOf(line), line]));
  const changed = actual.flatMap((line) => {
    const previous = before.get(idOf(line));
    if (previous === line) return [];
    return previous === undefined ? [`+ ${line}`] : [`- ${previous}`, `+ ${line}`];
  });
  const removed = expected.filter((line) => !known.has(idOf(line))).map((line) => `- ${line}`);
  return [...changed, ...removed];
};

/**
 * The expectation after a run: actual lines replace expected ones by id, documents not fetched keep theirs, and
 * documents no longer in the manifest (known) are dropped.
 */
export const updatedSummary = (expected: readonly string[], actual: readonly string[], known: ReadonlySet<string>): string[] => {
  const merged = new Map(expected.filter((line) => known.has(idOf(line))).map((line) => [idOf(line), line]));
  actual.forEach((line) => merged.set(idOf(line), line));
  return [...merged.values()].toSorted((left, right) => idOf(left).localeCompare(idOf(right)));
};
