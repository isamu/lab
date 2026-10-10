/** 解析器が読みを持たない名前の字（健汰 の 汰）から、その字の名前での読みへ。語彙表 name-char-reading が言う。 */
export type CharReadings = ReadonlyMap<string, string>;

export const NO_CHAR_READINGS: CharReadings = new Map();

type ReadToken = { readonly surface: string; readonly reading?: string | undefined };

const isRead = (reading: string | undefined): reading is string => reading !== undefined && reading !== "";

/**
 * 語の読み。解析器の読みがあればそれ。無ければ、語の字がどれも語彙表にあるときだけ字の読みをつなぐ。一字でも読めなければ無い
 * （読めない字を飛ばすと、別の名前を同じ読みと言ってしまう）。
 */
export const tokenReadingOf = (token: ReadToken, chars: CharReadings): string | undefined => {
  if (isRead(token.reading)) return token.reading;
  const readings = [...token.surface].map((letter) => chars.get(letter));
  return readings.length > 0 && readings.every(isRead) ? readings.join("") : undefined;
};

/** 語を並べた名前の読み。読めない語が一つでもあれば無い。 */
export const readingOfWords = (words: readonly ReadToken[], chars: CharReadings): string | undefined => {
  const readings = words.map((token) => tokenReadingOf(token, chars));
  return words.length > 0 && readings.every(isRead) ? readings.join("") : undefined;
};
