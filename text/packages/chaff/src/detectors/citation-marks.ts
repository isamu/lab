// In-text citations and reference-list entries, read by shape. Pure. The shapes are the ones papers print ([3],
// (Smith, 2020), 〔3〕, …である3)。, a Markdown footnote); the words between authors (et al., ら) come from the
// language's citation-author-joiner lexicon, and the words that look like an author but are not (March 2020) from
// citation-not-author.
import { escapeRegExp } from "../orthography.ts";
import { referenceListSpans } from "../reference-lists.ts";
import type { ProseDocument, Span } from "../plugin.ts";

export type CitationStyle = "numeric" | "footnote" | "author-year" | "kikko" | "paren-number";

export type AuthorYear = { readonly author: string; readonly year: string };

export type CitationMark = {
  readonly start: number;
  readonly end: number;
  readonly style: CitationStyle;
  readonly written: string;
  /** The reference numbers it cites, ranges spread out (numeric, 〔〕 and paren-number styles). */
  readonly numbers: readonly number[];
  /** The authors and years it cites (author-year style); the first author's surname, lower-cased. */
  readonly authorYears: readonly AuthorYear[];
};

export type ReferenceEntry = { readonly start: number; readonly number?: number; readonly authorYear?: AuthorYear };

export type CitationWords = {
  /** Words that join two authors (and, &, ・). */
  readonly pairs: readonly string[];
  /** Words after the first author that stand for the rest (et al., ら). */
  readonly others: readonly string[];
  /** Capitalised words that take a year after them but are no author (months, seasons). Lower-cased. */
  readonly notAuthors: ReadonlySet<string>;
  /** The headings of a reference list (参考文献, References). */
  readonly referenceHeadings: readonly string[];
};

/** A range wider than this is not a citation range ([1990-2020] is years). */
const MAX_RANGE = 50;
/** Text inside a parenthetical citation: wide enough for three authors and years, short enough to stay one citation. */
const MAX_PAREN = 200;

const LATIN_NAME = "\\p{Lu}[\\p{L}’'\\-]+";
const JA_NAME = "[\\p{Script=Han}\\p{Script=Katakana}ー]{1,8}";
const YEAR = "(?:1[89]|20)\\d{2}[a-z]?";

const NUMBER_LIST = "\\d{1,3}(?:\\s*[,，、–—\\-]\\s*\\d{1,3})*";
const NUMERIC = new RegExp(`\\[(${NUMBER_LIST})\\](?!:)`, "gu");
const FOOTNOTE = /\[\^[^\]\s]{1,20}\](?!:)/gu;
const KIKKO = new RegExp(`〔(${NUMBER_LIST})〕`, "gu");
/** …である3)。: a number and a closing parenthesis straight after Japanese text, before punctuation or the line's end. */
const PAREN_NUMBER = /(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー」』）])(\d{1,3}(?:[,，、–—-]\d{1,3})*)\)(?=[、。，．\s]|$)/gmu;
const PARENTHETICAL = new RegExp(`[(（]([^()（）\\n]{4,${String(MAX_PAREN)}})[)）]`, "gu");
/** The start of a line, up to a list marker: a number there numbers an item, it cites nothing. */
const LINE_HEAD = /^[ \t]*(?:[-*+][ \t]+)?$/u;
const ENTRY_NUMBER = /^[ \t]{0,3}(?:[-*+][ \t]+)?(?:\[(\d{1,4})\]|(\d{1,4})[.)）]|〔(\d{1,4})〕)/u;

const alternation = (words: readonly string[]): string =>
  words
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");

/** One author as cited: a surname, maybe a second joined by and or ・, maybe "et al." or ら. */
const authorPattern = (words: CitationWords): string => {
  const name = `(?:${LATIN_NAME}|${JA_NAME})`;
  const pair = words.pairs.length === 0 ? "" : `(?:\\s?(?:${alternation(words.pairs)})\\s?${name})?`;
  const others = words.others.length === 0 ? "" : `(?:\\s?(?:${alternation(words.others)}))?`;
  return `${name}${pair}${others}`;
};

/** "1, 3-5" as [1, 3, 4, 5]. A range that runs backwards or wider than MAX_RANGE is no citation, and gives []. */
export const numbersIn = (list: string): number[] => {
  const parts = list.split(/[,，、]/u).map((part) => part.split(/[–—-]/u).map((bound) => Number(bound.trim())));
  const spread = parts.map(([from = 0, to]) => {
    if (to === undefined) return [from];
    return to < from || to - from > MAX_RANGE ? undefined : Array.from({ length: to - from + 1 }, (_, index) => from + index);
  });
  return spread.some((part) => part === undefined) ? [] : spread.flatMap((part) => part ?? []);
};

const lineBefore = (text: string, offset: number): string => text.slice(text.lastIndexOf("\n", offset - 1) + 1, offset);

const isInside = (spans: readonly Span[], offset: number): boolean => spans.some((span) => span.start <= offset && offset < span.end);

/** [1] after a link's text ([manual][1]) is the link's label, not a citation; [1][2] is two citations. */
const isLinkLabel = (text: string, offset: number): boolean =>
  text[offset - 1] === "]" && !/\[[\d\s,，、–—-]+\]$/u.test(text.slice(Math.max(0, offset - 40), offset));

const depthChange = (char: string): number => {
  if ("(（".includes(char)) return 1;
  return ")）".includes(char) ? -1 : 0;
};

const opensParenthesis = (line: string): boolean => [...line].reduce((depth, char) => depth + depthChange(char), 0) > 0;

const numberedMarks = (text: string, pattern: RegExp, style: CitationStyle): CitationMark[] =>
  [...text.matchAll(pattern)].flatMap((match): CitationMark[] => {
    const numbers = numbersIn(match[1] ?? "");
    const line = lineBefore(text, match.index);
    if (numbers.length === 0 || LINE_HEAD.test(line)) return [];
    if (style === "numeric" && isLinkLabel(text, match.index)) return [];
    if (style === "paren-number" && opensParenthesis(line)) return [];
    return [{ start: match.index, end: match.index + match[0].length, style, written: match[0], numbers, authorYears: [] }];
  });

const footnoteMarks = (text: string): CitationMark[] =>
  [...text.matchAll(FOOTNOTE)]
    .filter((match) => !LINE_HEAD.test(lineBefore(text, match.index)))
    .map((match) => ({ start: match.index, end: match.index + match[0].length, style: "footnote", written: match[0], numbers: [], authorYears: [] }));

/** The first author's surname, lower-cased, without a word for the rest (山田ら is 山田). */
export const authorKey = (author: string, others: readonly string[]): string => {
  const first = author.split(/[\s・,，、]/u)[0] ?? author;
  const other = others.find((word) => first.length > word.length && first.endsWith(word));
  return (other === undefined ? first : first.slice(0, -other.length)).toLowerCase();
};

const authorYearOf = (author: string, year: string, others: readonly string[]): AuthorYear => ({ author: authorKey(author, others), year: year.slice(0, 4) });

const LATIN = /[a-z]/u;

/** A month or a season before a year is no author; in Japanese, an author holding 年度 or 調査 is not one either. */
const isNotAuthor = (author: string, words: CitationWords): boolean =>
  words.notAuthors.has(author) || [...words.notAuthors].some((word) => !LATIN.test(word) && author.includes(word));

/** The authors and years of one parenthetical: every part between semicolons must read as authors and years. */
const parentheticalCitations = (inner: string, words: CitationWords): AuthorYear[] | undefined => {
  const one = new RegExp(`^(?:[a-z.]+,?\\s){0,3}(${authorPattern(words)})[,，、]?\\s?(${YEAR})(?:[,，]\\s?${YEAR})*$`, "u");
  const parts = inner.split(/[;；]/u).map((part) => one.exec(part.trim()));
  if (parts.some((part) => part === null)) return undefined;
  const cited = parts.flatMap((part) => (part === null ? [] : [authorYearOf(part[1] ?? "", part[2] ?? "", words.others)]));
  return cited.some((entry) => isNotAuthor(entry.author, words)) ? undefined : cited;
};

const authorYearMark = (match: RegExpMatchArray, authorYears: readonly AuthorYear[]): CitationMark => {
  const start = match.index ?? 0;
  return { start, end: start + match[0].length, style: "author-year", written: match[0], numbers: [], authorYears };
};

const authorYearMarks = (text: string, words: CitationWords): CitationMark[] => {
  const parenthetical = [...text.matchAll(PARENTHETICAL)].flatMap((match): CitationMark[] => {
    const authorYears = parentheticalCitations(match[1] ?? "", words);
    return authorYears === undefined ? [] : [authorYearMark(match, authorYears)];
  });
  const narrative = new RegExp(`(?<![\\p{Script=Han}\\p{Script=Katakana}A-Za-z])(${authorPattern(words)})\\s?[(（](${YEAR})[)）]`, "gu");
  const narratives = [...text.matchAll(narrative)].flatMap((match): CitationMark[] => {
    const cited = authorYearOf(match[1] ?? "", match[2] ?? "", words.others);
    return isNotAuthor(cited.author, words) ? [] : [authorYearMark(match, [cited])];
  });
  return [...parenthetical, ...narratives.filter((mark) => !parenthetical.some((other) => other.start <= mark.start && mark.start < other.end))];
};

/** The document's in-text citations, outside its reference lists, in document order. text has code masked (doc.prose). */
export const citationMarks = (text: string, referenceLists: readonly Span[], words: CitationWords): CitationMark[] =>
  [
    ...numberedMarks(text, NUMERIC, "numeric"),
    ...numberedMarks(text, KIKKO, "kikko"),
    ...numberedMarks(text, PAREN_NUMBER, "paren-number"),
    ...footnoteMarks(text),
    ...authorYearMarks(text, words),
  ]
    .filter((mark) => !isInside(referenceLists, mark.start))
    .toSorted((left, right) => left.start - right.start);

const LIST_MARKER = /^[ \t]{0,3}[-*+][ \t]/u;
/** An unbulleted entry that follows another without a blank line: "Smith, A. (2020)." at the start of the line, not a wrapped line. */
const SURNAME_INITIAL = /^\p{Lu}[\p{L}’'-]+, \p{Lu}\./u;
const YEAR_IN = new RegExp(`(?<!\\d)(${YEAR})(?!\\d)`, "u");
const ENTRY_AUTHOR = new RegExp(`^[ \\t]{0,3}(?:[-*+][ \\t]+)?(${LATIN_NAME}|${JA_NAME})`, "u");

/** One line of a reference list as an entry: a numbered one, or one that opens an item or a paragraph with an author and gives a year. */
const entryOf = (line: string, previous: string | undefined, start: number): ReferenceEntry | undefined => {
  const numbered = ENTRY_NUMBER.exec(line);
  if (numbered !== null) return { start, number: Number(numbered[1] ?? numbered[2] ?? numbered[3]) };
  if (previous?.trim() !== "" && !LIST_MARKER.test(line) && !SURNAME_INITIAL.test(line)) return undefined;
  const author = ENTRY_AUTHOR.exec(line)?.[1];
  const year = YEAR_IN.exec(line)?.[1];
  return author === undefined || year === undefined ? undefined : { start, authorYear: authorYearOf(author, year, []) };
};

/** Each entry of the reference lists: its number, or the first author's surname and the year. The first line is the heading. */
export const referenceEntries = (text: string, referenceLists: readonly Span[]): ReferenceEntry[] =>
  referenceLists.flatMap((list) => {
    const lines = text.slice(list.start, list.end).split("\n");
    const starts = lines.reduce<number[]>((offsets, line) => [...offsets, (offsets.at(-1) ?? list.start) + line.length + 1], [list.start]);
    return lines.flatMap((line, index) => {
      const entry = index === 0 ? undefined : entryOf(line, lines[index - 1], starts[index] ?? 0);
      return entry === undefined ? [] : [entry];
    });
  });

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

export const citationWordsOf = (doc: ProseDocument): CitationWords => {
  const joiners = doc.lexicons["citation-author-joiner"] ?? [];
  return {
    pairs: joiners.filter((entry) => entry.group === "pair").map((entry) => entry.pattern),
    others: joiners.filter((entry) => entry.group !== "pair").map((entry) => entry.pattern),
    notAuthors: new Set(patternsOf(doc, "citation-not-author").map((word) => word.toLowerCase())),
    referenceHeadings: patternsOf(doc, "reference-list-heading"),
  };
};

/** The reference lists of the document, found by their headings. */
export const referenceListsOf = (doc: ProseDocument, words: CitationWords): Span[] => referenceListSpans(doc.source, words.referenceHeadings);
