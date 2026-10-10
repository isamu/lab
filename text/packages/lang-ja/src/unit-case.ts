// 語彙の単位が語（大文字小文字を問わずに読む）か、記号（書かれたとおりに読む）か。

/**
 * A word is three or more lowercase letters, possibly in several words ("percent", "per cent", "million", "yen"). Anything
 * else is a symbol whose case carries meaning: a capital the lexicon wrote (USD, kDa, mL vs ML), or a lowercase symbol of
 * one or two letters (m vs M, g vs G, mg vs Mg).
 */
const UNIT_WORD = /^\p{Ll}{3,}(?: \p{Ll}+)*$/u;

export const isUnitWord = (unit: string): boolean => UNIT_WORD.test(unit);

/** "8.5 Percent", "198 Million Yen": a unit word starts at `at` in any case; a symbol only as the lexicon wrote it. */
export const startsWithUnit = (text: string, at: number, unit: string): boolean =>
  isUnitWord(unit) ? text.slice(at, at + unit.length).toLowerCase() === unit : text.startsWith(unit, at);
