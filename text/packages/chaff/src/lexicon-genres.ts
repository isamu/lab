import type { Lexicon } from "./plugin.ts";

/** A genre is in a target when it is the target or one of its genres (legal/contract is in legal). */
const isIn = (genre: string, target: string): boolean => genre === target || genre.startsWith(`${target}/`);

/**
 * The entries of a word list that hold for the document's genre: an entry without genres holds everywhere, one with genres only
 * in those genres or groups. With no genre known, only the entries for every genre.
 */
export const entriesForGenre = (lexicon: Lexicon, genre: string | undefined): Lexicon =>
  lexicon.filter((entry) => entry.genres === undefined || (genre !== undefined && entry.genres.some((target) => isIn(genre, target))));
