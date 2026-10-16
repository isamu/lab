import type { LexiconEntry, Token } from "../plugin.ts";
import type { TokenRange } from "./lexicon-match.ts";

// An open-end word on a list of acts that gives examples of a kind of act named right after it: 印刷等、二次的に利用される
// 場合 and 印刷等の二次的利用 say "secondary use, such as printing". The kind bounds the list, so it leaves nothing open.
// A list followed by the manner of the act the requirement asks for (ログ等、具体的に保存すること) names no kind and stays
// open. The link (、 の) and the suffix that makes a word name a kind (的) come from the language's requirement-open-end
// lexicon. Pure.

/** The lexicon groups: a link right after the open word, and a suffix that makes the noun after it name a kind. */
const LINK = "class-link";
const CLASS_SUFFIX = "class-suffix";
const NAME_POS: ReadonlySet<string> = new Set(["NOUN", "PROPN"]);
/** The tagger's mark of a noun that names an act (印刷, 利用: a verbal noun). */
const ACT_NOUN = "Vnoun";
const PUNCT = "PUNCT";
/** The parts of speech a phrase about the act ends in before its comma (場合、 には、). */
const PHRASE_END_POS: ReadonlySet<string> = new Set(["NOUN", "PROPN", "ADP"]);
/** How many tokens may stand between the suffix and the act it qualifies (二次的に利用: に). */
const SUFFIX_REACH = 2;

export type ClassWords = { readonly links: ReadonlySet<string>; readonly suffixes: ReadonlySet<string> };

const patternsIn = (entries: readonly LexiconEntry[], group: string): ReadonlySet<string> =>
  new Set(entries.filter((entry) => entry.group === group).map((entry) => entry.pattern));

export const classWordsOf = (entries: readonly LexiconEntry[]): ClassWords => ({
  links: patternsIn(entries, LINK),
  suffixes: patternsIn(entries, CLASS_SUFFIX),
});

/** Whether an entry is one of the class cues rather than an open-end word. */
export const isClassCue = (entry: LexiconEntry): boolean => entry.group === LINK || entry.group === CLASS_SUFFIX;

const isActNoun = (token: Token | undefined): boolean => token !== undefined && token.features?.VerbForm === ACT_NOUN;

const attached = (left: Token | undefined, right: Token | undefined): boolean =>
  left !== undefined && right !== undefined && left.span.end === right.span.start;

/** The index of the last noun written one after another from index on, or index - 1 when no noun stands there. */
const nounRunEnd = (tokens: readonly Token[], index: number): number => {
  const token = tokens[index];
  if (token === undefined || !NAME_POS.has(token.pos)) return index - 1;
  return attached(token, tokens[index + 1]) ? nounRunEnd(tokens, index + 1) : index;
};

/**
 * Whether the act at index heads a phrase the requirement is about (利用される場合、 二次的利用には、): its clause ends in
 * a noun or a particle before a comma inside the sentence. An act whose clause runs to the end of the sentence, or ends
 * in a verb (保存すること。 保存し、), is what the requirement asks for, and the list before it stays open.
 */
const headsPhrase = (tokens: readonly Token[], index: number): boolean => {
  const comma = tokens.findIndex((token, at) => at > index && token.pos === PUNCT);
  const last = tokens[comma - 1];
  const goesOn = tokens.slice(comma + 1).some((token) => token.pos !== PUNCT && token.surface.trim() !== "");
  return comma !== -1 && goesOn && last !== undefined && PHRASE_END_POS.has(last.pos);
};

/** Whether the noun run that starts at index holds a class suffix (二次的, 営利的) and an act that heads a phrase follows within reach. */
const kindOfActAt = (tokens: readonly Token[], index: number, words: ClassWords): boolean => {
  const end = nounRunEnd(tokens, index);
  const suffix = tokens.slice(index + 1, end + 1).findIndex((token) => words.suffixes.has(token.surface));
  if (suffix === -1) return false;
  const afterSuffix = index + 1 + suffix + 1;
  const act = tokens.slice(afterSuffix, afterSuffix + SUFFIX_REACH).findIndex((token) => isActNoun(token));
  return act !== -1 && headsPhrase(tokens, afterSuffix + act);
};

/**
 * Whether the open word ends a list of acts that gives examples of a kind of act named right after it: the item before
 * the word is an act (印刷), a link follows (、 の), then a noun built with a class suffix (二次的) and an act (利用).
 * range: the tokens the open word covers.
 */
export const namesClassAfter = (tokens: readonly Token[], range: TokenRange, words: ClassWords): boolean => {
  const link = tokens[range.end];
  if (!isActNoun(tokens[range.start - 1]) || link === undefined || !words.links.has(link.surface)) return false;
  return kindOfActAt(tokens, range.end + 1, words);
};
