// A quotation the text gives to someone (「…」と述べている, according to X, "…") in a paragraph that names no source for it:
// no link, no footnote or numbered citation, no year in brackets. Whether the words are really that person's is for
// `chaff cite` against the source; this only says that there is nothing to check them against. The words that give a
// quotation to someone come from the language package's word list quote-attribution. A Markdown block quotation is
// given to someone by a dash line (> … / — Name) instead. Pure.
import { QUOTATION_MARKS, quotedSpans } from "../quoted-span.ts";
import { readMarkdown } from "../markdown-read.ts";
import { blockQuotations, type BlockQuotation } from "./block-quotation.ts";
import type { Detector, Finding, LexiconEntry, Paragraph, ProseDocument } from "../plugin.ts";

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

/**
 * The word lists the rule reads: quote-attribution, quote-advice (「…」と述べる方が: a wording suggested, not quoted), and
 * quote-not-attribution (an example made up by the writer, words received, words written on a thing).
 */
export type QuoteWords = { readonly cues: readonly LexiconEntry[]; readonly advice?: readonly LexiconEntry[]; readonly not?: readonly LexiconEntry[] };

const patternsIn = (entries: readonly LexiconEntry[], group: string): string[] =>
  entries.filter((entry) => entry.group === group && entry.pattern !== "").map((entry) => entry.pattern);

/**
 * Whether the words right after the closing mark suggest saying it that way: a say word, then an advice word (「…」と書く方が適切です).
 * A say word alone is not enough: 「…」と述べる方が多い reports what people say.
 */
const isAdvice = (text: string, quoted: Quoted, advice: readonly LexiconEntry[]): boolean => {
  const after = quoted.end + 1;
  const tails = patternsIn(advice, "advice");
  return patternsIn(advice, "say").some((say) => text.startsWith(say, after) && tails.some((tail) => text.startsWith(tail, after + say.length)));
};

/** A word of the group stands in the text (an English one as a whole word, ignoring case). */
const standsIn = (text: string, entries: readonly LexiconEntry[], group: string): boolean =>
  patternsIn(entries, group).some((word) => cueStarts(text, word).length > 0);

/** Words received rather than quoted, right after the closing mark: 「…」と言われて、送れない. */
const isReceived = (text: string, quoted: Quoted, not: readonly LexiconEntry[]): boolean =>
  patternsIn(not, "received").some((tail) => text.startsWith(tail, quoted.end + 1));

/** The cue's subject is a thing, by the word right before it: a sign that said "…". */
const THING_GAP = /^\s+$/u;
const saidByThing = (text: string, at: number, not: readonly LexiconEntry[]): boolean =>
  patternsIn(not, "thing").some((word) => cueStarts(text.slice(0, at), word).some((start) => THING_GAP.test(text.slice(start + word.length, at))));

/** A cue just before the quotation's opening mark, or just after its closing mark. position says which side it may stand on. */
/** Advice after the quotation silences only the cue after it: 山田氏によれば「…」と言う方が適切だ still gives the words to someone. */
const isAttributed = (text: string, quoted: Quoted, { cues, advice = [], not = [] }: QuoteWords): boolean => {
  if (standsIn(text.slice(0, quoted.start), not, "example")) return false;
  const advised = isAdvice(text, quoted, advice) || isReceived(text, quoted, not);
  return cues.some((cue) =>
    cueStarts(text, cue.pattern).some((at) => {
      if (saidByThing(text, at, not)) return false;
      const before = cue.position !== "after" && at + cue.pattern.length <= quoted.start - 1 && at + cue.pattern.length >= quoted.start - 1 - CUE_REACH_BEFORE;
      const after = !advised && cue.position !== "before" && at >= quoted.end + 1 && at <= quoted.end + 1 + CUE_REACH_AFTER;
      return before || after;
    }),
  );
};

/** A Latin-script quotation with no space in it is one word, a term or a value ("core_claim_false"), not someone's words. */
const isOneWord = (quote: string): boolean => LATIN.test(quote) && !/\s/u.test(quote);

const isWords = (quote: string): boolean => [...quote].length >= MIN_QUOTE_CHARS && !isOneWord(quote);

const quotesIn = (sentence: QuoteText, words: QuoteWords): UnsourcedQuote[] => {
  return quotedSpans(sentence.text, QUOTATION_MARKS)
    .filter((span) => isWords(sentence.text.slice(span.start, span.end).trim()) && isAttributed(sentence.text, span, words))
    .map((span) => ({ offset: sentence.start + span.start, quote: sentence.text.slice(span.start, span.end).trim() }));
};

/** Each quotation given to someone, in a paragraph that names no source. cues: the word list quote-attribution. */
export const unsourcedQuotes = (
  paragraphs: readonly QuoteParagraph[],
  cues: readonly LexiconEntry[],
  advice: readonly LexiconEntry[] = [],
  not: readonly LexiconEntry[] = [],
): UnsourcedQuote[] =>
  paragraphs
    .filter((paragraph) => !namesSource(paragraph.source))
    .flatMap((paragraph) => paragraph.sentences.flatMap((sentence) => quotesIn(sentence, { cues, advice, not })));

/** Each block quotation given to someone by a dash line (— Name) with no source in it or on that line. */
export const unsourcedBlockQuotes = (quotations: readonly BlockQuotation[]): UnsourcedQuote[] =>
  quotations
    .filter((quotation) => [...quotation.quote].length >= MIN_QUOTE_CHARS && !namesSource(quotation.passage))
    .map(({ offset, quote }) => ({ offset, quote }));

/** A dash and a `>` must both be there before the Markdown is read again. */
const MAY_HOLD_BLOCK_QUOTE = /^[ \t]*>/mu;
const MAY_HOLD_DASH = /[—―–]|--/u;

const blockQuotesOf = (doc: ProseDocument): UnsourcedQuote[] => {
  if (!MAY_HOLD_BLOCK_QUOTE.test(doc.source) || !MAY_HOLD_DASH.test(doc.source) || doc.markup?.markdown !== true) return [];
  return unsourcedBlockQuotes(blockQuotations(readMarkdown(doc.source).root, doc.source));
};

/**
 * The lines written together with a paragraph, with no blank line between: a note's quotation and the reference on the line
 * above it are one block, and a source named there is named for the quotation.
 */
const blockAround = (doc: ProseDocument, index: number): string => {
  const joined = (left: Paragraph | undefined, right: Paragraph | undefined): boolean =>
    left !== undefined && right !== undefined && !doc.source.slice(left.span.end, right.span.start).includes("\n\n");
  const first = doc.paragraphs.slice(0, index + 1).findLastIndex((paragraph, at) => !joined(doc.paragraphs[at - 1], paragraph));
  const after = doc.paragraphs.slice(index).findIndex((paragraph, offset) => !joined(paragraph, doc.paragraphs[index + offset + 1]));
  const last = doc.paragraphs[index + after] ?? doc.paragraphs[index];
  return doc.source.slice(doc.paragraphs[first]?.span.start ?? 0, last?.span.end ?? 0);
};

const paragraphQuotesOf = (doc: ProseDocument): UnsourcedQuote[] =>
  unsourcedQuotes(
    doc.paragraphs.map((paragraph, index) => ({
      source: blockAround(doc, index),
      sentences: paragraph.sentences.map((sentence) => ({ start: sentence.span.start, text: sentence.text })),
    })),
    doc.lexicons["quote-attribution"] ?? [],
    doc.lexicons["quote-advice"] ?? [],
    doc.lexicons["quote-not-attribution"] ?? [],
  );

/** Every quotation in the document given to someone with no source, in document order: what the rule and `cite --scaffold` list. */
export const documentQuotesWithoutSource = (doc: ProseDocument): UnsourcedQuote[] =>
  [...paragraphQuotesOf(doc), ...blockQuotesOf(doc)].toSorted((left, right) => left.offset - right.offset);

export const quoteWithoutSource: Detector = (doc: ProseDocument): Finding[] =>
  documentQuotesWithoutSource(doc).map((hit) => ({
    rule: "quote-without-source",
    severity: "info",
    line: 0,
    column: 0,
    quote: hit.quote,
    values: { quote: hit.quote, offset: hit.offset },
  }));
