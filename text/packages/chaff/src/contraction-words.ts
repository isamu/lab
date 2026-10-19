/**
 * The words a text's contractions stand for beyond the one written: "don't" is "do not", one more word. A length in
 * words then stays the same when a writer expands or contracts, which chaff takes no side on. Only endings that are
 * always a contraction count; 's counts after the words where it cannot be a possessive (it's, that's, let's).
 */
const APOSTROPHE = "['’ʼ]";
/** Each contracted ending after a letter, so a stacked one (I'd've) counts twice. */
const ALWAYS_CONTRACTED = new RegExp(`(?<=\\p{L})(?:n${APOSTROPHE}t|${APOSTROPHE}(?:re|ve|ll|m|d))(?![\\p{L}\\p{N}])`, "giu");
const IS_AFTER = new RegExp(`(?<![\\p{L}\\p{N}])(?:it|that|there|here|what|who|where|how|he|she|let)${APOSTROPHE}s(?![\\p{L}\\p{N}])`, "giu");

export const contractionExtraWords = (text: string): number => [...text.matchAll(ALWAYS_CONTRACTED)].length + [...text.matchAll(IS_AFTER)].length;
