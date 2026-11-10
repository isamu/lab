import type { Detector, Finding } from "../plugin.ts";

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

/**
 * 中黒で並べると、どこまでが 1 つの項目か分からなくなる。
 * 「企画・開発・運用・保守体制」は、保守体制が 1 つなのか保守と体制なのか読めない。
 * 語彙表（nakaguro-word）の、中黒を含めて 1 語の語（キャッシュ・フロー）の中黒は並べていないので数えない。
 */
export const middleDot: Detector = (doc, options): Finding[] => {
  const words = (options.lexicon ?? []).map((entry) => entry.pattern).toSorted((left, right) => right.length - left.length);
  return doc.sentences
    .map((sentence) => ({ sentence, count: parallelDotCount(sentence.text, words) }))
    .filter(({ count }) => count > options.limit)
    .map(({ sentence, count }) => ({
      rule: "no-nakaguro-parallel",
      severity: "info",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { count, limit: options.limit, offset: sentence.span.start },
    }));
};
