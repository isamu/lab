import type { Lexicon, Sentence, Token } from "../plugin.ts";

// 並べた定義: どの文も違う語を、同じ型（〜を指します、〜といいます）で定義する。同じ文末が続くのは型をそろえたからで、
// 書き手の調子の繰り返しではない。

const TRAILING_POS: ReadonlySet<string> = new Set(["PUNCT", "SYM"]);
const TAIL_POS: ReadonlySet<string> = new Set(["AUX", "PART"]);

export type DefinitionWords = { readonly frames: ReadonlySet<string>; readonly topics: ReadonlySet<string> };

const patternsOf = (lexicon: Lexicon | undefined, group: string): ReadonlySet<string> =>
  new Set((lexicon ?? []).filter((entry) => entry.group === group).map((entry) => entry.pattern));

export const definitionWordsOf = (lexicon: Lexicon | undefined): DefinitionWords => ({
  frames: patternsOf(lexicon, "frame"),
  topics: patternsOf(lexicon, "topic"),
});

const surfacesOf = (tokens: readonly Token[]): string => tokens.map((token) => token.surface).join("");

/** 述語（文末の助動詞の前の語）の位置。助動詞で終わらない文には無い。 */
const predicateAt = (tokens: readonly Token[]): number | undefined => {
  const last = tokens.findLastIndex((token) => !TRAILING_POS.has(token.pos));
  const head = tokens.slice(0, last + 1).findLastIndex((token) => !TAIL_POS.has(token.pos));
  return head > 0 && head < last ? head : undefined;
};

const PARTICLE_POS = "ADP";
const TERM_POS: ReadonlySet<string> = new Set(["NOUN", "PROPN"]);

/** 定義の文が定義する語と、その型（を指す）。 */
export type Definition = { readonly term: string; readonly frame: string };

/** topic の助詞（は）より前。無ければ、述語の前の助詞の直前の名詞（〜を台風といいます の 台風）。 */
const termOf = (tokens: readonly Token[], head: number, words: DefinitionWords): string => {
  const topic = tokens.slice(0, head - 1).findIndex((token) => token.pos === PARTICLE_POS && words.topics.has(token.surface));
  if (topic > 0) return surfacesOf(tokens.slice(0, topic));
  const before = tokens[head - 2];
  return before !== undefined && TERM_POS.has(before.pos) ? before.surface : "";
};

/** その文が定義する語と型。型の文（を指す、という）でなければ無い。 */
export const definitionOf = (sentence: Sentence, words: DefinitionWords): Definition | undefined => {
  const tokens = (sentence.tokens ?? []).filter((token) => token.surface.trim() !== "");
  const head = predicateAt(tokens);
  const particle = head === undefined ? undefined : tokens[head - 1];
  const predicate = head === undefined ? undefined : tokens[head];
  if (head === undefined || particle === undefined || predicate === undefined) return undefined;
  const frame = `${particle.surface}${predicate.lemma ?? predicate.surface}`;
  if (!words.frames.has(frame)) return undefined;
  const term = termOf(tokens, head, words);
  return term === "" ? undefined : { term, frame };
};

const isDefinition = (definition: Definition | undefined): definition is Definition => definition !== undefined;

/** どの文も同じ型の定義で、定義する語がみな違う。 */
export const isParallelDefinition = (sentences: readonly Sentence[], words: DefinitionWords): boolean => {
  const definitions = sentences.map((sentence) => definitionOf(sentence, words));
  if (!definitions.every(isDefinition)) return false;
  const terms = new Set(definitions.map((definition) => definition.term));
  const frames = new Set(definitions.map((definition) => definition.frame));
  return terms.size === definitions.length && frames.size === 1;
};
