// A citation with no entry in the reference list, or an entry never cited. Pure. Checked only where both sides are
// read mechanically: numbered entries against numbered citations, author-year entries against author-year citations.
// An entry is reported as never cited only when most entries are cited, so a paper whose citations chaff cannot read
// (superscripts lost in a copy) is not reported entry by entry.
import {
  citationMarks,
  citationWordsOf,
  referenceEntries,
  referenceListsOf,
  type AuthorYear,
  type CitationMark,
  type ReferenceEntry,
} from "./citation-marks.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding } from "../plugin.ts";

/** A reference list needs this many entries of one kind to be read as numbered or as author-year. */
const MIN_ENTRIES = 2;

export type CitationSlip =
  | { readonly variant: "missing"; readonly offset: number; readonly citation: string; readonly key: string }
  | { readonly variant: "uncited"; readonly offset: number; readonly key: string };

type Keyed = { readonly key: string; readonly start: number };

/** One kind of citation and its entries, and whether an entry's key is what a citation's key names. */
type Side = {
  readonly entries: readonly Keyed[];
  readonly citations: readonly { readonly mark: CitationMark; readonly keys: readonly string[] }[];
  readonly names: (entryKey: string, citedKey: string) => boolean;
};

const NUMBERED_STYLES = new Set(["numeric", "kikko", "paren-number"]);
const LATIN = /[a-z]/u;

const keyOf = (cited: AuthorYear): string => `${cited.year} ${cited.author}`;

/** A cited Japanese surname this long or longer may be the head of an entry's full name; a shorter one (林) must match whole. */
const MIN_PREFIX_SURNAME = 2;

/** The same year, and the same surname; a Japanese entry gives the full name (山田太郎) where the text cites the surname (山田). */
export const namesEntry = (entryKey: string, citedKey: string): boolean => {
  if (entryKey === citedKey) return true;
  const surname = citedKey.slice(citedKey.indexOf(" ") + 1);
  return !LATIN.test(citedKey) && [...surname].length >= MIN_PREFIX_SURNAME && entryKey.startsWith(citedKey);
};

/**
 * namesEntry, and also a one-character Japanese surname (森, 林) against the full name it heads (森達也) when no other entry
 * of that year starts with it: the list then leaves no other work it could name, where 林 beside 林田太郎 and 林正 does.
 */
export const namesEntryAmong =
  (entryKeys: readonly string[]) =>
  (entryKey: string, citedKey: string): boolean => {
    if (namesEntry(entryKey, citedKey)) return true;
    if (LATIN.test(citedKey) || !entryKey.startsWith(citedKey)) return false;
    return entryKeys.filter((key) => key.startsWith(citedKey)).length === 1;
  };

const numberedSide = (entries: readonly ReferenceEntry[], marks: readonly CitationMark[]): Side => ({
  entries: entries.flatMap((entry) => (entry.number === undefined ? [] : [{ key: String(entry.number), start: entry.start }])),
  citations: marks.filter((mark) => NUMBERED_STYLES.has(mark.style)).map((mark) => ({ mark, keys: mark.numbers.map(String) })),
  names: (entryKey, citedKey) => entryKey === citedKey,
});

const authorYearSide = (entries: readonly ReferenceEntry[], marks: readonly CitationMark[]): Side => {
  const keyed = entries.flatMap((entry) => (entry.authorYear === undefined ? [] : [{ key: keyOf(entry.authorYear), start: entry.start }]));
  return {
    entries: keyed,
    citations: marks.filter((mark) => mark.style === "author-year").map((mark) => ({ mark, keys: mark.authorYears.map(keyOf) })),
    names: namesEntryAmong(keyed.map((entry) => entry.key)),
  };
};

export const sideSlips = (side: Side): CitationSlip[] => {
  if (side.entries.length < MIN_ENTRIES || side.citations.length === 0) return [];
  const citedKeys = [...new Set(side.citations.flatMap((citation) => citation.keys))];
  const isCited = (entry: Keyed): boolean => citedKeys.some((key) => side.names(entry.key, key));
  const missing = side.citations.flatMap((citation) =>
    citation.keys
      .filter((key) => !side.entries.some((entry) => side.names(entry.key, key)))
      .map((key): CitationSlip => ({ variant: "missing", offset: citation.mark.start, citation: citation.mark.written, key })),
  );
  const uncitedEntries = side.entries.filter((entry) => !isCited(entry));
  // Most entries cited: the citations are read, so an entry none of them names is really never cited.
  const uncited =
    uncitedEntries.length * 2 <= side.entries.length
      ? uncitedEntries.map((entry): CitationSlip => ({ variant: "uncited", offset: entry.start, key: entry.key }))
      : [];
  return [...missing, ...uncited];
};

export const citationSlips = (entries: readonly ReferenceEntry[], marks: readonly CitationMark[]): CitationSlip[] =>
  [...sideSlips(numberedSide(entries, marks)), ...sideSlips(authorYearSide(entries, marks))].toSorted((left, right) => left.offset - right.offset);

export const citationEntry: Detector = (doc): Finding[] => {
  const words = citationWordsOf(doc);
  const lists = referenceListsOf(doc, words);
  if (lists.length === 0) return [];
  return citationSlips(referenceEntries(doc.source, lists), citationMarks(doc.prose ?? doc.source, lists, words)).map((slip) => ({
    rule: "citation-reference-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, slip.offset),
    values: { citation: slip.variant === "missing" ? slip.citation : "", key: slip.key.split(" ").toReversed().join(" "), offset: slip.offset },
    variant: slip.variant,
  }));
};
