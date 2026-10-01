import { QUOTATION_MARKS, quotedSpans } from "../quoted-span.ts";
import type { Span } from "../plugin.ts";
import type { Atom } from "./atom.ts";
import { coversOffset, overlapsAny, spanIndex, type SpanIndex } from "./spans.ts";

/** Where a reader looks, and how it says where it found something. */
export type TextInput = { readonly text: string; readonly source: string; readonly lineOf: (offset: number) => number };

/** A fact found in the text: where it is and its key. */
export type Found = Span & { readonly key: string };

export const atomsOf = (found: readonly Found[], kind: Atom["kind"], input: TextInput): Atom[] =>
  found.map((fact) => ({ kind, key: fact.key, text: input.source.slice(fact.start, fact.end), line: input.lineOf(fact.start) }));

const DIGIT = "[0-9０-９]";
const DATE_SEPARATOR = "[-/.／．]";

/** 2026/4/1, 2026-04-01, 2026.4.1: a year of four digits first, so the order is never in doubt. */
const NUMERIC_DATE = new RegExp(`(?<![0-9０-９])(${DIGIT}{4})${DATE_SEPARATOR}(${DIGIT}{1,2})${DATE_SEPARATOR}(${DIGIT}{1,2})(?![0-9０-９])`, "gu");

const MONTHS = 12;
const LAST_DAY = 31;
const PADDED = 2;

const dateKey = (year: string, month: string, day: string): string | undefined => {
  const [m, d] = [Number(month.normalize("NFKC")), Number(day.normalize("NFKC"))];
  if (m < 1 || m > MONTHS || d < 1 || d > LAST_DAY) return undefined;
  return [year.normalize("NFKC"), String(m).padStart(PADDED, "0"), String(d).padStart(PADDED, "0")].join("-");
};

/** Dates written in figures only, where the language's date reader did not already read a date. */
export const numericDates = (text: string, taken: SpanIndex): Found[] =>
  [...text.matchAll(NUMERIC_DATE)].flatMap((match) => {
    const key = dateKey(match[1] ?? "", match[2] ?? "", match[3] ?? "");
    const span = { start: match.index, end: match.index + match[0].length };
    return key === undefined || overlapsAny(taken, span) ? [] : [{ ...span, key }];
  });

/** A footnote mark `[^1]`, or the footnote itself `[^1]:`. */
const FOOTNOTE = /\[\^[^\]\s]+\]:?/gu;

export const footnotes = (text: string): Found[] =>
  [...text.matchAll(FOOTNOTE)].map((match) => ({ start: match.index, end: match.index + match[0].length, key: match[0] }));

/** 1,200 or 12.5 or ３: the digits, a thousands separator only between groups of three, and a decimal part. */
const NUMBER = /[0-9０-９]+(?:[,，][0-9０-９]{3})*(?:[.．][0-9０-９]+)?/gu;

const valueOf = (written: string): string => String(Number(written.normalize("NFKC").replace(/,/gu, "")));

/** Numbers no other reader took: written with no unit the language package knows, or with none at all. */
export const bareNumbers = (input: TextInput, taken: SpanIndex): Atom[] =>
  [...input.text.matchAll(NUMBER)].flatMap((match): Atom[] => {
    if (coversOffset(taken, match.index)) return [];
    const value = valueOf(match[0]);
    return [{ kind: "number", key: `${value} `, text: match[0], line: input.lineOf(match.index), unitless: true, value }];
  });

/** A paragraph break: a quotation does not run over one, and reading paragraph by paragraph keeps each read short. */
const PARAGRAPH_BREAK = /\n[ \t]*\n/gu;

const paragraphsOf = (text: string): Span[] => {
  const breaks = [...text.matchAll(PARAGRAPH_BREAK)].map((match) => match.index);
  return [-1, ...breaks].map((from, index) => ({ start: from + 1, end: breaks[index] ?? text.length }));
};

/** What is quoted, as one spelling: line breaks and runs of spaces are how it was wrapped, not what it says. */
const quoteKey = (inner: string): string => inner.normalize("NFKC").replace(/\s+/gu, " ").trim();

/** Quoted strings: 「」『』, “” and "". The key is what is inside; the marks are how it is written. */
export const quotations = (input: TextInput): Atom[] =>
  paragraphsOf(input.text).flatMap((paragraph) =>
    quotedSpans(input.text.slice(paragraph.start, paragraph.end), QUOTATION_MARKS).flatMap((inner) => {
      const key = quoteKey(input.text.slice(paragraph.start + inner.start, paragraph.start + inner.end));
      const span = { start: paragraph.start + inner.start - 1, end: paragraph.start + inner.end + 1 };
      return key === "" ? [] : atomsOf([{ ...span, key }], "quote", input);
    }),
  );

const occurrences = (text: string, name: string): Span[] => {
  const found: Span[] = [];
  for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + name.length)) found.push({ start: at, end: at + name.length });
  return found;
};

/** The team's own names (chaff.yaml's `names:`), wherever they are written. Longer names first: "Acme Cloud" before "Acme". */
export const teamNames = (text: string, names: readonly string[]): Found[] => {
  const longestFirst = [...new Set(names.filter((name) => name !== ""))].toSorted((left, right) => right.length - left.length);
  return longestFirst
    .reduce<Found[]>((taken, name) => {
      const index = spanIndex(taken);
      const fresh = occurrences(text, name).filter((span) => !overlapsAny(index, span));
      return [...taken, ...fresh.map((span) => ({ ...span, key: name }))];
    }, [])
    .toSorted((left, right) => left.start - right.start);
};
