// redundant-expression: phrase-match over the language's pairs, except a pair whose last word starts a hyphenated compound
// ("true fact-check" is a fact-check whose verdict is true, not a true fact).
import type { Detector, LexiconEntry, Sentence, Token } from "../plugin.ts";
import { entryRanges } from "./lexicon-match.ts";
import { phraseMatchWhere } from "./phrase-match.ts";

const HYPHENS: ReadonlySet<string> = new Set(["-", "‐"]);

const joined = (left: Token | undefined, right: Token | undefined): boolean => left !== undefined && right !== undefined && left.span.end === right.span.start;

/** The token at end is a hyphen that ties the word before it to the next word, with no space on either side. */
export const hyphenatedOnward = (tokens: readonly Token[], end: number): boolean => {
  const hyphen = tokens[end];
  const next = tokens[end + 1];
  return hyphen !== undefined && HYPHENS.has(hyphen.surface) && joined(tokens[end - 1], hyphen) && joined(hyphen, next) && /^\p{L}/u.test(next?.surface ?? "");
};

/** Some place of the pair in the sentence ends a phrase rather than running on into a compound. Without tokens every place counts. */
const standsAsPair = (sentence: Sentence, entry: LexiconEntry): boolean => {
  const tokens = sentence.tokens ?? [];
  const ranges = entryRanges(sentence, entry);
  return ranges.length === 0 || ranges.some((range) => !hyphenatedOnward(tokens, range.end));
};

export const redundantPair: Detector = (doc, options) => phraseMatchWhere(doc, options, standsAsPair);
