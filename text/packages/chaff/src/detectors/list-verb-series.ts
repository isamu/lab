import type { Token } from "../plugin.ts";
import { opensObject } from "./list-item-phrase.ts";

// The words of a series an English list item opens with (Scope, estimate and describe tasks; Dry and lube the chain). Pure.

const isSeriesJoint = (token: Token): boolean => token.surface === "," || token.pos === "CCONJ";

/** The single words of a series the item opens with: "Scope, estimate and describe tasks" gives Scope, estimate, describe. */
export const openingSeries = (tokens: readonly Token[], at: number): readonly Token[] => {
  const word = tokens[at];
  if (word === undefined) return [];
  const after = tokens.findIndex((token, index) => index > at && !isSeriesJoint(token));
  return after === -1 || after === at + 1 ? [word] : [word, ...openingSeries(tokens, after)];
};

/** The tags a verb the tagger misread may carry (Dry as an adjective, lube as a noun); a preposition (from) never is one. */
const VERB_SHAPED: ReadonlySet<string> = new Set(["VERB", "NOUN", "ADJ"]);

/** A series of two words or more, each one a verb could be, that "the", "a" or "your" follows: verbs and their object. */
export const seriesTakesObject = (tokens: readonly Token[], at: number): boolean => {
  const series = openingSeries(tokens, at);
  const last = series.at(-1);
  return series.length > 1 && series.every((word) => VERB_SHAPED.has(word.pos)) && last !== undefined && opensObject(tokens[tokens.indexOf(last) + 1]);
};
