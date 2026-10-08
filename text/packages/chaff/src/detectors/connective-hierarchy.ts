import type { Detector, Finding, LexiconEntry, Sentence, Span, Token } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { quotedSpans } from "../quoted-span.ts";

// A connective that joins only the outer level of a two-level list, in a sentence with no inner level under it. The
// lexicon holds both levels: an entry with a rewrite is an outer-level word (rewrite is the word a one-level list uses),
// and an entry with instead_of is an inner-level word that stands under that outer-level word.

/** One outer-level connective with nothing to stand above, and where it is in the document. */
export type LoneConnective = { readonly offset: number; readonly written: string; readonly usual: string };

const CONJUNCTION = "CCONJ";

/**
 * The word lists the detector reads: the connectives, the phrases that hold one's letters without being one (歯並びに), and
 * the ends of a condition clause (ときは、): an inner-level word is looked for in the outer-level word's own clause only.
 */
export type ConnectiveLists = {
  readonly connectives: readonly LexiconEntry[];
  readonly lookalikes: readonly LexiconEntry[];
  readonly clauseEnds: readonly LexiconEntry[];
};

/**
 * The tagger does not always tell a connective from a noun and a particle: it reads 申請書並びに as 並び + に and
 * 文字の並びに as the conjunction. After の, a determiner or an adjective (の並びに, この並びに, 正しい並びに) the word is
 * a noun of its own. Where the tagger splits it, it is a connective only between two nouns: a noun, a number or a mark
 * before it, and no verb right after it (一列並びに座る).
 */
const MODIFIES_NOUN: ReadonlySet<string> = new Set(["DET", "ADJ"]);
const GENITIVE = "の";
const JOINS_AFTER: ReadonlySet<string> = new Set(["NOUN", "PROPN", "NUM", "PUNCT", "SYM"]);
const ENDS_CLAUSE: ReadonlySet<string> = new Set(["VERB", "AUX"]);

const modifiesNoun = (token: Token | undefined): boolean =>
  token !== undefined && (MODIFIES_NOUN.has(token.pos) || (token.pos === "ADP" && token.surface === GENITIVE));

const joinsNouns = (previous: Token | undefined, next: Token | undefined): boolean =>
  previous !== undefined && JOINS_AFTER.has(previous.pos) && next !== undefined && !ENDS_CLAUSE.has(next.pos);

/** A sentence's tokens by where they start and end, and the letters a connective there would not be read in. */
type Reading = { readonly byStart: ReadonlyMap<number, Token>; readonly byEnd: ReadonlyMap<number, Token>; readonly hidden: readonly boolean[] };

const placesOf = (text: string, word: string): number[] => [...text.matchAll(new RegExp(escapeRegExp(word), "gu"))].map((match) => match.index);

/** Inside 「」 or 『』 (a quoted phrase holds half a list) or inside a lookalike (歯並びに), by the sentence's own offsets. */
const hiddenLetters = (text: string, lookalikes: readonly LexiconEntry[]): boolean[] => {
  const hidden = Array.from({ length: text.length }, () => false);
  const hide = (start: number, end: number): boolean[] => hidden.fill(true, start, end);
  quotedSpans(text).forEach((span) => hide(span.start, span.end));
  lookalikes.forEach(({ pattern }) => placesOf(text, pattern).forEach((at) => hide(at, at + pattern.length)));
  return hidden;
};

const readingOf = (sentence: Sentence, lookalikes: readonly LexiconEntry[]): Reading => {
  const tokens = sentence.tokens ?? [];
  return {
    byStart: new Map(tokens.map((token) => [token.span.start, token])),
    byEnd: new Map(tokens.map((token) => [token.span.end, token])),
    hidden: hiddenLetters(sentence.text, lookalikes),
  };
};

const standsAsConnective = (reading: Reading, span: Span): boolean => {
  const previous = reading.byEnd.get(span.start);
  if (modifiesNoun(previous)) return false;
  const own = reading.byStart.get(span.start);
  const tagged = own !== undefined && own.pos === CONJUNCTION && own.span.end === span.end;
  return tagged || joinsNouns(previous, reading.byStart.get(span.end));
};

/**
 * The clause of the text the letter at `at` is in: from the end of the last clause end before it (ときは、) to the end of
 * the first one after it. A list in a condition clause and one in the main clause are not levels of one list. A clause
 * end with a connective right after it (…ときは、又は…場合には) joins two conditions, and does not cut.
 */
export const clauseAround = (text: string, at: number, clauseEnds: readonly LexiconEntry[], connectives: readonly LexiconEntry[] = []): string => {
  const joinsNext = (end: number): boolean => connectives.some(({ pattern }) => pattern !== "" && text.startsWith(pattern, end));
  const ends = clauseEnds
    .filter(({ pattern }) => pattern !== "")
    .flatMap(({ pattern }) => placesOf(text, pattern).map((start) => start + pattern.length))
    .filter((end) => !joinsNext(end));
  const start = Math.max(0, ...ends.filter((end) => end <= at));
  const end = Math.min(text.length, ...ends.filter((end) => end > at));
  return text.slice(start, end);
};

const hasInnerLevel = (clause: string, outer: LexiconEntry, connectives: readonly LexiconEntry[]): boolean =>
  connectives.some((entry) => entry.instead_of === outer.pattern && clause.includes(entry.pattern));

/** Where one outer-level word stands as a connective in the sentence with no inner-level word in its clause. */
const connectiveSpans = (sentence: Sentence, outer: LexiconEntry, reading: Reading, lists: ConnectiveLists): Span[] =>
  placesOf(sentence.text, outer.pattern)
    .filter((at) => reading.hidden[at] !== true)
    .filter((at) => !hasInnerLevel(clauseAround(sentence.text, at, lists.clauseEnds, lists.connectives), outer, lists.connectives))
    .map((at) => ({ start: sentence.span.start + at, end: sentence.span.start + at + outer.pattern.length }))
    .filter((span) => standsAsConnective(reading, span));

/** The outer-level connectives of a sentence that stand over no inner level. */
export const loneConnectivesIn = (sentence: Sentence, lists: ConnectiveLists): LoneConnective[] => {
  const lone = lists.connectives.filter((entry) => entry.rewrite !== undefined && sentence.text.includes(entry.pattern));
  if (lone.length === 0) return [];
  const reading = readingOf(sentence, lists.lookalikes);
  return lone
    .flatMap((entry) =>
      connectiveSpans(sentence, entry, reading, lists).map((span) => ({ offset: span.start, written: entry.pattern, usual: entry.rewrite ?? "" })),
    )
    .sort((a, b) => a.offset - b.offset);
};

export const connectiveHierarchy: Detector = (doc, options): Finding[] => {
  const lists = {
    connectives: options.lexicon ?? [],
    lookalikes: doc.lexicons["connective-lookalike"] ?? [],
    clauseEnds: doc.lexicons["connective-clause-end"] ?? [],
  };
  return doc.sentences.flatMap((sentence) =>
    loneConnectivesIn(sentence, lists).map((lone) => ({
      rule: "",
      severity: "info",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { written: lone.written, usual: lone.usual, offset: lone.offset },
    })),
  );
};
