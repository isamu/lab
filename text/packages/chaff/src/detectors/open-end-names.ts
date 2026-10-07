import type { LexiconEntry, ProseDocument, Sentence, Token } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { entryRanges, type TokenRange } from "./lexicon-match.ts";

// A word that leaves a list open (等, etc.) is also part of names a document gives itself: 「業務執行取締役等」,
// 銀行等（…をいう。）, the head of a definition item (四の二 親会社等 …をいう。), and longer nouns built on them
// (監査等委員会設置会社). There the document closes the list, so the word leaves nothing open. Pure: the document and the
// language's words come in.

/** The parts of speech a name is made of. */
const NAME_POS = new Set(["NOUN", "PROPN"]);
/** A quoted name: what 「」『』“”"" hold, short enough to be a term rather than a sentence. */
const QUOTED = /[「『“"]([^「」『』“”"\n]{1,40})[」』”"]/gu;
/** The brackets of an aside that can define the name in front of it: 銀行等（銀行…をいう。）. */
const ASIDE_CLOSE: Readonly<Record<string, string>> = { "（": "）", "(": ")" };
/** How far an aside is read for its closing bracket. A definition's aside is a clause, not a page. */
const MAX_ASIDE_CHARS = 600;
/** The label before the head of a definition item, with the space after it (四の二 , (a) ). */
const ITEM_LABEL = /^\s*\S{1,8}\s+$/u;
/** A word right after the head that makes it the subject of a sentence (親会社等は), not the head of an item. */
const FUNCTION_POS = new Set(["ADP", "AUX", "PART", "SCONJ", "CCONJ", "PUNCT"]);

/**
 * One place where an open-end word stands: its sentence's tokens, the tokens the word covers, the noun it is part of
 * (first and last token: 監査 … 会社 around 等 in 監査等委員会設置会社), and the word's document offsets.
 */
type Occurrence = {
  readonly sentence: Sentence;
  readonly tokens: readonly Token[];
  readonly range: TokenRange;
  readonly first: number;
  readonly last: number;
  readonly start: number;
  readonly end: number;
};

/** A quoted name and where the open-end word stands in it. */
type QuotedName = { readonly name: string; readonly at: readonly number[] };

/**
 * The names a document gives that contain an open-end word: the ones it quotes, the ones it defines in an aside right
 * after them (whole, as written there), and the heads of its definition items (which may run on into the definition).
 */
export type OpenEndNames = { readonly quoted: readonly QuotedName[]; readonly defined: ReadonlySet<string>; readonly heads: readonly string[] };

const attached = (left: Token | undefined, right: Token | undefined): boolean =>
  left !== undefined && right !== undefined && left.span.end === right.span.start;
const isNameToken = (token: Token | undefined): boolean => token !== undefined && NAME_POS.has(token.pos);

/** The index of the first noun of the run written right before index, or index itself when none is. */
const runStart = (tokens: readonly Token[], index: number): number =>
  isNameToken(tokens[index - 1]) && attached(tokens[index - 1], tokens[index]) ? runStart(tokens, index - 1) : index;

/** The index of the last noun of the run written right after index, or index itself when none is. */
const runEnd = (tokens: readonly Token[], index: number): number =>
  isNameToken(tokens[index + 1]) && attached(tokens[index], tokens[index + 1]) ? runEnd(tokens, index + 1) : index;

const occurrencesIn = (sentence: Sentence, entry: LexiconEntry): Occurrence[] => {
  const tokens = sentence.tokens ?? [];
  return entryRanges(sentence, entry).flatMap((range) => {
    const firstWord = tokens[range.start];
    const lastWord = tokens[range.end - 1];
    if (firstWord === undefined || lastWord === undefined) return [];
    const first = runStart(tokens, range.start);
    const last = runEnd(tokens, range.end - 1);
    return [{ sentence, tokens, range, first, last, start: firstWord.span.start, end: lastWord.span.end }];
  });
};

const startOf = (occurrence: Occurrence, index: number): number => occurrence.tokens[index]?.span.start ?? occurrence.start;
const endOf = (occurrence: Occurrence, index: number): number => occurrence.tokens[index]?.span.end ?? occurrence.end;

/** The noun the word is part of, as written (当該監査等委員会). */
const nounOf = (source: string, occurrence: Occurrence): string => source.slice(startOf(occurrence, occurrence.first), endOf(occurrence, occurrence.last));

/** The text inside the aside that opens at offset, or undefined when none opens there or it does not close soon. */
export const asideAt = (source: string, offset: number): string | undefined => {
  const open = source.charAt(offset);
  const close = ASIDE_CLOSE[open];
  if (close === undefined) return undefined;
  const chars = [...source.slice(offset + 1, offset + 1 + MAX_ASIDE_CHARS)];
  const depths: number[] = [];
  chars.forEach((char) => depths.push((depths.at(-1) ?? 1) + (char === open ? 1 : 0) - (char === close ? 1 : 0)));
  const end = depths.indexOf(0);
  return end === -1 ? undefined : chars.slice(0, end).join("");
};

const says = (text: string, statements: readonly string[]): boolean => statements.some((word) => text.includes(word));

/** Whether the noun is defined in the aside right after it (銀行等（銀行…をいう。）). */
const definedInAside = (source: string, occurrence: Occurrence, statements: readonly string[]): boolean => {
  const aside = asideAt(source, endOf(occurrence, occurrence.last));
  return aside !== undefined && says(aside, statements);
};

/** Whether the noun heads a definition item: a label before it, no particle right after the word, and a definition in the rest (四の二 親会社等 …をいう。). */
const headsItem = (source: string, occurrence: Occurrence, statements: readonly string[]): boolean => {
  const next = occurrence.tokens[occurrence.range.end];
  if (next !== undefined && next.surface.trim() !== "" && FUNCTION_POS.has(next.pos)) return false;
  const before = source.slice(occurrence.sentence.span.start, startOf(occurrence, occurrence.first));
  return ITEM_LABEL.test(before) && says(source.slice(endOf(occurrence, occurrence.last), occurrence.sentence.span.end), statements);
};

const quotedNames = (source: string, words: readonly LexiconEntry[]): QuotedName[] =>
  [...source.matchAll(QUOTED)].flatMap((match) => {
    const name = match[1] ?? "";
    const at = words.flatMap((word) => [...name.matchAll(new RegExp(escapeRegExp(word.pattern), "gu"))].map((found) => found.index));
    return at.length === 0 ? [] : [{ name, at }];
  });

/** The names a document gives that contain an open-end word. statements: the language's words of a definition (をいう, means). */
export const openEndNames = (doc: ProseDocument, words: readonly LexiconEntry[], statements: readonly string[]): OpenEndNames => {
  const occurrences = doc.sentences.flatMap((sentence) => words.flatMap((word) => occurrencesIn(sentence, word)));
  const defined = occurrences.filter((occurrence) => definedInAside(doc.source, occurrence, statements)).map((occurrence) => nounOf(doc.source, occurrence));
  const heads = occurrences.filter((occurrence) => headsItem(doc.source, occurrence, statements)).map((occurrence) => nounOf(doc.source, occurrence));
  return { quoted: quotedNames(doc.source, words), defined: new Set(defined), heads: [...new Set(heads)] };
};

/** Whether a quoted name holds this occurrence: the text around it reads the whole name (当該責任追及等 holds 「責任追及等」). */
const inQuotedName = (source: string, occurrence: Occurrence, quoted: readonly QuotedName[]): boolean =>
  quoted.some(({ name, at }) => at.some((index) => source.startsWith(name, occurrence.start - index)));

/**
 * The parts of the noun, cut at word boundaries, that hold the word and a noun before it: 当該監査等委員, 監査等委員, 監査等 … for 当該監査等委員.
 * A part that is a defined name narrows it (当該金銭等, 特定役員等), and the definition closes its list.
 */
const partsHoldingWord = (source: string, occurrence: Occurrence): string[] => {
  const { tokens, range, first, last } = occurrence;
  const starts = tokens.slice(first, range.start).map((token) => token.span.start);
  const ends = tokens.slice(range.end - 1, last + 1).map((token) => token.span.end);
  return starts.flatMap((start) => ends.map((end) => source.slice(start, end)));
};

const isNamed = (source: string, occurrence: Occurrence, names: OpenEndNames): boolean =>
  inQuotedName(source, occurrence, names.quoted) ||
  partsHoldingWord(source, occurrence).some((part) => names.defined.has(part) || names.heads.some((head) => head.startsWith(part)));

/** Where the word first stands outside a name the document gives (its document offset), or undefined when it never does. */
export const openEndAt = (doc: ProseDocument, sentence: Sentence, word: LexiconEntry, names: OpenEndNames): number | undefined =>
  occurrencesIn(sentence, word).find((occurrence) => !isNamed(doc.source, occurrence, names))?.start;
