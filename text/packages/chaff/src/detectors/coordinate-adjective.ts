import type { Token } from "../plugin.ts";
import type { TokenRange } from "./token-column.ts";
import { firstOf, secondOf, withoutFirst, type View } from "./list-view.ts";

// Coordinate adjectives before one noun (long-term, strategic collaboration): the comma between them is not a list comma,
// and the first adjective is not an item. Pure.

const MODIFIER_POS: ReadonlySet<string> = new Set(["ADJ"]);
/** The first half of a hyphened modifier (long-term, well-known). */
const COMPOUND_HEAD_POS: ReadonlySet<string> = new Set(["ADJ", "ADV"]);
const NOUN_POS: ReadonlySet<string> = new Set(["NOUN", "PROPN"]);
const HYPHEN = "-";

/** The item's tokens without the punctuation at its edges (the comma that closes it). */
const wordsOf = (tokens: readonly Token[], item: TokenRange): Token[] => {
  const inside = tokens.slice(item.start, item.end);
  const start = inside.findIndex((token) => token.pos !== "PUNCT");
  return start === -1 ? [] : inside.slice(start, inside.findLastIndex((token) => token.pos !== "PUNCT") + 1);
};

/**
 * An item that ends in a hyphened modifier whose first half is an adjective or an adverb (CISA's long-term). A plain
 * adjective is left alone: it is as often an item of its own (the disabled, elderly residents, and veterans).
 */
export const endsWithModifier = (words: readonly Token[]): boolean =>
  words.length >= 3 && words.at(-2)?.surface === HYPHEN && COMPOUND_HEAD_POS.has(words.at(-3)?.pos ?? "");

/** An item that opens with an adjective right before a noun (strategic collaboration with …), not a lone adjective. */
export const opensWithModifiedNoun = (words: readonly Token[]): boolean => MODIFIER_POS.has(words[0]?.pos ?? "") && NOUN_POS.has(words[1]?.pos ?? "");

/**
 * The list without its first item when that item is the first of two coordinate adjectives on the second item's noun
 * (… from CISA's long-term, strategic collaboration with A and B: the and joins two items, not three).
 */
export const withoutCoordinateAdjective = (view: View): View => {
  const [first, second] = [firstOf(view), secondOf(view)];
  if (first === undefined || second === undefined) return view;
  const { tokens } = view.list.scope.sentence;
  const coordinate = endsWithModifier(wordsOf(tokens, first.item)) && opensWithModifiedNoun(wordsOf(tokens, second.item));
  return coordinate ? withoutFirst(view) : view;
};
