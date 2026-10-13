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

/** 名の字の読みで読み直す、名の字数の下限。一字の名（太 を フトシ）は、二字の名の中の読み（健太 の タ）で読まない。 */
const MIN_GIVEN_LETTERS = 2;

/**
 * 名をもう一通りに読んだもの。解析器は名を別の読みに切ることがある（建太 を タテ と フトシ）。字がどれも givenChars（名の中での
 * 字の読み）にある語はその字の読みをつなぎ、ほかの語は tokenReadingOf で読む。一字の名と、読めない語のある名は読まない。
 */
export const givenNameReadingOf = (words: readonly ReadToken[], givenChars: CharReadings, chars: CharReadings): string | undefined => {
  if (words.reduce((letters, token) => letters + [...token.surface].length, 0) < MIN_GIVEN_LETTERS) return undefined;
  const readings = words.map((token) => {
    const letters = [...token.surface].map((letter) => givenChars.get(letter));
    return letters.length > 0 && letters.every(isRead) ? letters.join("") : tokenReadingOf(token, chars);
  });
  return readings.every(isRead) ? readings.join("") : undefined;
};
