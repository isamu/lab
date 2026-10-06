// A quotation the text gives to someone (「…」と述べている, according to X, "…") in a paragraph that names no source for it:
// no link, no footnote or numbered citation, no year in brackets. Whether the words are really that person's is for
// `chaff cite` against the source; this only says that there is nothing to check them against. The words that give a
// quotation to someone come from the language package's word list quote-attribution. Pure.
import { QUOTATION_MARKS, quotedSpans } from "../quoted-span.ts";
import type { Detector, Finding, LexiconEntry, ProseDocument } from "../plugin.ts";

export type QuoteText = { readonly start: number; readonly text: string };

export type QuoteParagraph = { readonly source: string; readonly sentences: readonly QuoteText[] };

export type UnsourcedQuote = { readonly offset: number; readonly quote: string };

/** Shorter than this, a quotation is a term or a label (「保存」, "Save"), not someone's words. */
const MIN_QUOTE_CHARS = 10;

/**
 * A link, a bare URL, a footnote mark, a numbered citation ([3]) or a year that ends a bracket as a citation's does: alone
 * ((1975), （1999年）), after a comma (（架空の本、1975年）) or after a name ((Brooks 1975)). Not (port 2000).
 */
const SOURCE_MARKS = [
  /\]\(/u,
  /https?:\/\//u,
  /\[\^[^\]\s]+\]/u,
  /\[\d{1,3}(?:[,，、–-]\s*\d{1,3})*\]/u,
  /[（(](?:1[5-9]|20)\d\d[a-z]?年?[）)]/u,
  /[（(][^（）()\n]*[,、，]\s*(?:1[5-9]|20)\d\d[a-z]?年?[）)]/u,
  /[（(]\p{Lu}[^（）()\n]*\s(?:1[5-9]|20)\d\d[a-z]?[）)]/u,
];

/** How far before a quotation a cue may end ("According to the study, “…”", 先輩によれば「…」). */
const CUE_REACH_BEFORE = 40;
/** How far after a quotation a cue may start: a space ("“…,” said"), or none (「…」と述べた, not 「…」などと書く). */
const CUE_REACH_AFTER = 1;

const LATIN = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;

const namesSource = (paragraph: string): boolean => SOURCE_MARKS.some((mark) => mark.test(paragraph));

const escaped = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Where the cue stands in the sentence, ignoring case, in the sentence's own positions (lowercasing first would move them:
 * İ becomes two units). An English cue is not read inside a longer word (says in essays).
 */
const cueStarts = (text: string, cue: string): number[] => {
  if (cue === "") return [];
  return [...text.matchAll(new RegExp(escaped(cue), "giu"))]
    .map((match) => match.index)
    .filter((at) => !LATIN.test(cue) || (!LETTER.test(text.charAt(at - 1)) && !LETTER.test(text.charAt(at + cue.length))));
};

type Quoted = { readonly start: number; readonly end: number };

/** A cue just before the quotation's opening mark, or just after its closing mark. position says which side it may stand on. */
const isAttributed = (text: string, quoted: Quoted, cues: readonly LexiconEntry[]): boolean =>
  cues.some((cue) =>
    cueStarts(text, cue.pattern).some((at) => {
      const before = cue.position !== "after" && at + cue.pattern.length <= quoted.start - 1 && at + cue.pattern.length >= quoted.start - 1 - CUE_REACH_BEFORE;
      const after = cue.position !== "before" && at >= quoted.end + 1 && at <= quoted.end + 1 + CUE_REACH_AFTER;
      return before || after;
    }),
  );

const quotesIn = (sentence: QuoteText, cues: readonly LexiconEntry[]): UnsourcedQuote[] => {
  return quotedSpans(sentence.text, QUOTATION_MARKS)
    .filter((span) => [...sentence.text.slice(span.start, span.end).trim()].length >= MIN_QUOTE_CHARS && isAttributed(sentence.text, span, cues))
    .map((span) => ({ offset: sentence.start + span.start, quote: sentence.text.slice(span.start, span.end).trim() }));
};

/** Each quotation given to someone, in a paragraph that names no source. cues: the word list quote-attribution. */
export const unsourcedQuotes = (paragraphs: readonly QuoteParagraph[], cues: readonly LexiconEntry[]): UnsourcedQuote[] =>
  paragraphs.filter((paragraph) => !namesSource(paragraph.source)).flatMap((paragraph) => paragraph.sentences.flatMap((sentence) => quotesIn(sentence, cues)));

export const quoteWithoutSource: Detector = (doc: ProseDocument): Finding[] =>
  unsourcedQuotes(
    doc.paragraphs.map((paragraph) => ({
      source: doc.source.slice(paragraph.span.start, paragraph.span.end),
      sentences: paragraph.sentences.map((sentence) => ({ start: sentence.span.start, text: sentence.text })),
    })),
    doc.lexicons["quote-attribution"] ?? [],
  ).map((hit) => ({
    rule: "quote-without-source",
    severity: "info",
    line: 0,
    column: 0,
    quote: hit.quote,
    values: { quote: hit.quote, offset: hit.offset },
  }));
