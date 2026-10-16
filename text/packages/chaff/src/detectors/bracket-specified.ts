import { asideAt } from "./open-end-names.ts";

// A vague word pinned down by the bracket right after it: 一定の事項（インボイスに記載が必要な事項）, a reasonable fee (USD 50).
// The aside says what the word leaves open, so the word is not vague there. An aside that only gives the phrase a name
// (以下「措置」という, hereinafter the "Fee") pins nothing down. Pure: the words that start a name come in.

/** What may stand between the vague word and the bracket: the noun it qualifies (事項, fee), no punctuation. */
const BEFORE_BRACKET = /^[\p{L}\p{N}\p{M} ]{0,12}?(?=[（(])/u;

const startsWithName = (aside: string, nameMarkers: readonly string[]): boolean => {
  const lower = aside.trimStart().toLowerCase();
  return nameMarkers.some((marker) => marker !== "" && lower.startsWith(marker.toLowerCase()));
};

/**
 * Whether the words right after end (an offset in text) are pinned down by a bracket: at most a short noun, then an
 * aside that opens and closes and holds more than a name. nameMarkers: the words that start a name (以下, hereinafter).
 */
export const specifiedByBracket = (text: string, end: number, nameMarkers: readonly string[]): boolean => {
  const rest = text.slice(end);
  const before = BEFORE_BRACKET.exec(rest);
  if (before === null) return false;
  const aside = asideAt(text, end + before[0].length);
  return aside !== undefined && aside.trim() !== "" && !startsWithName(aside, nameMarkers);
};
