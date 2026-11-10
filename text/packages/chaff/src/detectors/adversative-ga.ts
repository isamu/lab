// Which conjunctive が of a Japanese sentence join two clauses in contrast. Pure: reads the sentence's tokens only.
import type { Token } from "../plugin.ts";

/** The auxiliaries of the volitional (あろう, 見よう) and its negative (あるまい). */
const VOLITIONAL: ReadonlySet<string> = new Set(["う", "よう", "まい"]);
const CLOSING_POS: ReadonlySet<string> = new Set(["PUNCT", "SYM"]);

const isSpace = (token: Token | undefined): boolean => token !== undefined && token.surface.trim() === "";

/**
 * A verb's volitional before が (あろうがあるまいが, 何を言おうが): the main clause holds whichever way it goes, so nothing is
 * contrasted. The conjectural でしょうが, だろうが follows an auxiliary, not a verb, and does contrast.
 */
const wordBefore = (at: number, tokens: readonly Token[]): number => tokens.findLastIndex((token, index) => index < at && !isSpace(token));

const followsVolitional = (at: number, tokens: readonly Token[]): boolean => {
  const auxiliary = wordBefore(at, tokens);
  const verb = tokens[wordBefore(auxiliary, tokens)];
  return VOLITIONAL.has(tokens[auxiliary]?.surface ?? "") && tokens[auxiliary]?.pos === "AUX" && verb?.pos === "VERB";
};

/** A が with only punctuation after it (思えるんですが……。) softens the sentence's end; it joins no second clause. */
const endsSentence = (at: number, tokens: readonly Token[]): boolean => tokens.slice(at + 1).every((token) => isSpace(token) || CLOSING_POS.has(token.pos));

const NOMINAL_POS: ReadonlySet<string> = new Set(["NOUN", "PRON", "PROPN"]);

const isNominal = (token: Token | undefined): boolean => token !== undefined && NOMINAL_POS.has(token.pos);
const isComma = (token: Token | undefined): boolean => token?.surface === "、" || token?.surface === "，";

/**
 * A Kyushu dialect topic しや (あんたしやが, ムツシユウしやが): the parser reads a verb し with no particle after a bare noun,
 * then が as conjunctive; the が marks the noun.
 */
const followsDialectTopic = (at: number, tokens: readonly Token[]): boolean => {
  const [noun, verb, auxiliary] = [tokens[at - 3], tokens[at - 2], tokens[at - 1]];
  return isNominal(noun) && verb?.surface === "し" && verb.pos === "VERB" && auxiliary?.surface === "や" && auxiliary.pos === "AUX";
};

/** A copula cut from its noun by a comma (恋、では無いが): the writer takes back the word just said; no clause is contrasted. */
const takesBackWord = (at: number, tokens: readonly Token[]): boolean => {
  const comma = tokens.findLastIndex((token, index) => index < at && isComma(token));
  const [copula, topic] = [tokens[comma + 1], tokens[comma + 2]];
  return comma > 0 && isNominal(tokens[comma - 1]) && copula?.surface === "で" && copula.pos === "AUX" && topic?.surface === "は";
};

/** The conjunctive が at `at` contrasts two clauses: not a volitional's concession, not a softened end, not a misread particle. */
export const isContrastiveGa = (at: number, tokens: readonly Token[]): boolean =>
  !followsVolitional(at, tokens) && !endsSentence(at, tokens) && !followsDialectTopic(at, tokens) && !takesBackWord(at, tokens);
