import type { ProseDocument } from "../plugin.ts";
import { dayOrderOf, readableDate, type DateWords } from "../derived/readable-date.ts";
import { inDocumentOrder } from "../structure/issues.ts";

const MONTHS_IN_YEAR = 12;

const wordsOf = (doc: ProseDocument): DateWords => {
  const monthWords = (doc.lexicons["month-name"] ?? []).map((entry) => entry.pattern);
  const written = doc.structure === undefined ? [] : inDocumentOrder(doc.structure).flatMap((node) => (node.kind === "date" ? [doc.source.slice(node.span.start, node.span.end)] : []));
  return { language: doc.language, months: monthWords.slice(0, MONTHS_IN_YEAR), order: dayOrderOf(written, monthWords) };
};

const wordsByDocument = new WeakMap<ProseDocument, DateWords>();

/**
 * A date value (2026-06-30) as a message writes it, in the document's language and its own day order. The month names are
 * the language's month-name lexicon (January first). The document is read once, on the first date a message needs.
 */
export const readableDates =
  (doc: ProseDocument) =>
  (value: string): string => {
    const words = wordsByDocument.get(doc) ?? wordsOf(doc);
    wordsByDocument.set(doc, words);
    return readableDate(value, words);
  };

/** The named values written as readable dates; the other values as they are. */
export const withReadableDates = (
  values: Readonly<Record<string, string | number>>,
  keys: readonly string[],
  readable: (value: string) => string,
): Record<string, string | number> =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, keys.includes(key) && typeof value === "string" ? readable(value) : value]));
