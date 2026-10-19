/**
 * The words a text's contractions stand for beyond the one written: "don't" is "do not", one more word. A length in
 * words then stays the same when a writer expands or contracts, which chaff takes no side on. Only endings that are
 * always a contraction count; 's counts after the words where it cannot be a possessive (it's, that's, let's).
 */
const ALWAYS_CONTRACTED = /\b\p{L}+(?:n['’]t|['’](?:re|ve|ll|m|d))\b/giu;
const IS_AFTER = /\b(?:it|that|there|here|what|who|where|how|he|she|let)['’]s\b/giu;

export const contractionExtraWords = (text: string): number => [...text.matchAll(ALWAYS_CONTRACTED)].length + [...text.matchAll(IS_AFTER)].length;
