import type { Token } from "../plugin.ts";
import type { TokenRange } from "./token-column.ts";
import { firstOf, secondOf, withoutFirst, type View } from "./list-view.ts";
import { isBareIndefiniteModifier } from "./list-item.ts";

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
 * (… from CISA's long-term, strategic collaboration with A and B: the and joins two items, not three), or an indefinite
 * article with adjectives only (A simple, minimalist palette of cool blue and gray), which no noun has closed yet.
 */
const withoutPairedModifier = (view: View): View => {
  const [first, second] = [firstOf(view), secondOf(view)];
  if (first === undefined || second === undefined) return view;
  const { tokens } = view.list.scope.sentence;
  const coordinate = endsWithModifier(wordsOf(tokens, first.item)) && opensWithModifiedNoun(wordsOf(tokens, second.item));
  return coordinate || isBareIndefiniteModifier(view.list.scope, first.item) ? withoutFirst(view) : view;
};

/** One modifier: an adjective, or a hyphened word (non-exclusive, royalty-free), which the parser often tags as nouns. */
export const isOneModifier = (words: readonly Token[]): boolean =>
  (words.length === 1 && MODIFIER_POS.has(words[0]?.pos ?? "")) || (words.length === 3 && words[1]?.surface === HYPHEN);

/** Modifiers parted by commas (non-transferrable, non-sublicensable), which the comma after an adjective has joined into one item. */
const isModifierRun = (words: readonly Token[]): boolean => {
  const comma = words.findIndex((word) => word.surface === ",");
  if (comma === -1) return isOneModifier(words);
  return isOneModifier(words.slice(0, comma)) && isModifierRun(words.slice(comma + 1));
};

/** Words a modifier run before its noun may hold: modifiers, nouns, hyphens and the commas between coordinate modifiers. */
const RUN_POS: ReadonlySet<string> = new Set(["ADJ", "NOUN", "PROPN", "PUNCT", "X"]);

/**
 * An item that is modifiers then a noun, opening with a modifier (limited right; revocable, limited right, where the
 * comma after an adjective has already joined two items).
 */
export const isModifiedNounRun = (words: readonly Token[]): boolean => {
  const width = words[1]?.surface === HYPHEN ? 3 : 1;
  return isOneModifier(words.slice(0, width)) && words.length > width && words.every((word) => RUN_POS.has(word.pos)) && NOUN_POS.has(words.at(-1)?.pos ?? "");
};

/** An item that ends in an indefinite article and one modifier (grants Licensee a non-exclusive). */
const endsWithArticleModifier = (words: readonly Token[], indefinite: ReadonlySet<string>): boolean => {
  const at = words.findLastIndex((word) => indefinite.has(word.surface.toLowerCase()));
  return at !== -1 && isModifierRun(words.slice(at + 1));
};

/** The view without its leading items while each holds only modifiers and another item follows. */
const withoutModifiers = (view: View, tokens: readonly Token[]): View => {
  const [first, second] = [firstOf(view), secondOf(view)];
  if (first === undefined || second === undefined || !isModifierRun(wordsOf(tokens, first.item))) return view;
  return withoutModifiers(withoutFirst(view), tokens);
};

/**
 * The list without its items when an indefinite article opens a run of single modifiers that ends in the one item with a
 * noun (a non-exclusive, revocable, limited right and license): the article has one noun phrase, its commas part
 * coordinate modifiers, and the and / or joins nouns inside that phrase.
 */
const withoutModifierRun = (view: View): View => {
  const first = firstOf(view);
  if (first === undefined || secondOf(view) === undefined) return view;
  const { tokens, words } = view.list.scope.sentence;
  if (!endsWithArticleModifier(wordsOf(tokens, first.item), words.indefinite ?? new Set())) return view;
  const rest = withoutModifiers(withoutFirst(view), tokens);
  const head = firstOf(rest);
  return head !== undefined && secondOf(rest) === undefined && isModifiedNounRun(wordsOf(tokens, head.item)) ? rest : view;
};

export const withoutCoordinateAdjective = (view: View): View => withoutPairedModifier(withoutModifierRun(view));
