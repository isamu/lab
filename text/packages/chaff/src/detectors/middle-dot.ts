const MIDDLE_DOT = /・/gu;

/** 文頭か行頭（前に空白だけ）の「・」。前に並べる項目が無いので、箇条書きの印。 */
const BULLET_DOT = /(^|\n)[^\S\n]*・/gu;

/** 中黒を含めて 1 語の語（キャッシュ・フロー）を、中黒を除いた形にする。この中黒は語の切れ目で、項目を並べてはいない。 */
const withoutWordDots = (text: string, words: readonly string[]): string =>
  words.reduce((joined, word) => joined.replaceAll(word, word.replaceAll("・", "")), text);

/**
 * 項目を並べる中黒の数。箇条書きの印の「・」と、中黒を含めて 1 語の語（words: キャッシュ・フロー）の中黒は数えない。
 * 「・ 水分を補給すること」が何行続いても、どこまでが 1 つの項目かは改行で読める。
 */
export const parallelDotCount = (text: string, words: readonly string[] = []): number =>
  [...withoutWordDots(text, words).replace(BULLET_DOT, "$1").matchAll(MIDDLE_DOT)].length;
