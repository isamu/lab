// How an English list item reads as a phrase: a noun phrase may hold verbs of its own (Text that is at least 11pt, lists
// using the tools), and a full stop may close an aside rather than the item. Pure; reads the item's tokens.
import type { Token } from "../plugin.ts";

/** Parts of speech a noun phrase is made of; the Japanese reading of an item's ending uses them too. */
export const NOMINAL = new Set(["NOUN", "PROPN", "NUM", "PRON"]);
export const NOUN_HEAD = new Set(["NOUN", "ADJ", "DET", "NUM", "PRON", "PROPN"]);
export const SENTENCE_END = /[.!?。．！？]["'”’)）」』]*$/u;

/** A finite verb or auxiliary: an English item with one says something. A gerund or participle (Running, nested) does not. */
export const isFiniteVerb = (token: Token): boolean =>
  (token.pos === "VERB" || token.pos === "AUX") && !["Ger", "Part"].includes(token.features?.["VerbForm"] ?? "");

export const isVerb = (token: Token): boolean => token.pos === "VERB" || token.pos === "AUX";

/** A determiner that opens an object (the, a, your): no noun phrase goes on from its head with one. */
export const opensObject = (token: Token | undefined): boolean => token?.features?.["PronType"] === "Art" || token?.features?.["Poss"] === "Yes";

/**
 * An -ed word the tagger left without VerbForm (decreased, agreed, unauthorized): like a participle, it may modify the noun
 * after it. Proceed and need end in -ed too but are their own base forms.
 */
export const isPastForm = (token: Token): boolean =>
  token.pos === "VERB" &&
  token.features?.["VerbForm"] === undefined &&
  /ed$/iu.test(token.surface) &&
  (token.lemma !== token.surface.toLowerCase() || !/eed$/iu.test(token.surface));

/** A relative pronoun after a noun (text that is …, staff who work …): the verbs of its clause belong to the noun phrase. */
const RELATIVE_PRONOUNS = new Set(["that", "which", "who", "whom", "whose"]);

const opensRelativeClause = (tokens: readonly Token[], at: number): boolean =>
  RELATIVE_PRONOUNS.has(tokens[at]?.surface.toLowerCase() ?? "") && NOMINAL.has(tokens[at - 1]?.pos ?? "");

/** Words that hold a verb group together: verbs, auxiliaries, "not", adverbs and "to". */
const VERB_GROUP = new Set(["VERB", "AUX", "ADV", "PART"]);

/**
 * Where a relative clause's verb group starts: right after the pronoun (that is left justified), or at its first verb when
 * a subject or a word the tagger misread comes first (text that the user types, a layer that wicks moisture). A comma
 * ends the search.
 */
const clauseVerbStart = (tokens: readonly Token[], at: number): number => {
  const next = tokens.findIndex((token, index) => index > at && (isVerb(token) || token.pos === "PUNCT"));
  const found = tokens[next];
  return found !== undefined && isVerb(found) ? next : at + 1;
};

/**
 * The positions of a relative clause's own verb group: the verbs, with adverbs and "not", of each relative clause (that is
 * left justified, who are assessed). A verb after the group (Team members who are assessed … are eligible) is the item's
 * own.
 */
const relativeVerbGroups = (tokens: readonly Token[]): ReadonlySet<number> => {
  const positions = new Set<number>();
  tokens.forEach((_token, at) => {
    if (!opensRelativeClause(tokens, at)) return;
    const start = clauseVerbStart(tokens, at);
    const end = tokens.findIndex((token, index) => index >= start && !VERB_GROUP.has(token.pos));
    Array.from({ length: Math.max(0, (end === -1 ? tokens.length : end) - start) }, (_unused, offset) => positions.add(start + offset));
  });
  return positions;
};

/**
 * Whether an item opens as a noun phrase does: with a noun, an adjective or a determiner, or with an -ed word modifying
 * what follows (Bulleted or numbered lists). An -ed word before "the" or "a" is a verb and its object (Fixed the link).
 */
const opensNounPhrase = (tokens: readonly Token[]): boolean => {
  const [first, second] = [tokens[0], tokens[1]];
  if (first === undefined) return false;
  if (first.pos === "VERB") return (isPastForm(first) || first.features?.["VerbForm"] === "Part") && !opensObject(second);
  return NOUN_HEAD.has(first.pos) && first.pos !== "PRON";
};

/**
 * In an item that opens as a noun phrase, a verb that belongs to it: a participle or gerund (lists using the tools), an -ed
 * form, one after "to" (a background to ensure contrast), or one in a relative clause's verb group (Text that is large).
 */
const isPhraseVerb = (tokens: readonly Token[], at: number, relative: ReadonlySet<number>): boolean => {
  const token = tokens[at];
  if (token === undefined) return false;
  if (!isFiniteVerb(token) || isPastForm(token)) return true;
  return tokens[at - 1]?.pos === "PART" || relative.has(at);
};

/** Whether an item opens as a noun phrase and holds only the verbs of that phrase (Text that is at least 11pt). */
export const isNounPhraseWithVerbs = (tokens: readonly Token[]): boolean => {
  if (!opensNounPhrase(tokens)) return false;
  const relative = relativeVerbGroups(tokens);
  return tokens.every((token, at) => !isVerb(token) || isPhraseVerb(tokens, at, relative));
};

/** A full stop inside a closing bracket (tools (e.g. Captivate, etc.)): the aside's own stop, not the item's. */
const ASIDE_STOP = /\.\)$/u;

/** Whether an English item ends as a sentence does: a closing mark, not one that ends an aside opened inside the item. */
export const closesAsSentence = (text: string): boolean => SENTENCE_END.test(text) && !(ASIDE_STOP.test(text) && !text.startsWith("("));
