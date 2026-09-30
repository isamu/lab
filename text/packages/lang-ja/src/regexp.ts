// lang-en/src/regexp.ts の写し。アダプタは互いに依存しないので、和文の中の英文に同じ手当てをするために置く。元とのずれは test_mixed_language_stops.ts で比べる。
/** A word from a lexicon, matched as written: a sign in it is that character, not a pattern. */
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
