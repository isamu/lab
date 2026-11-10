import type { Detector, Finding } from "../plugin.ts";
import { isFlattenedTable } from "./sentence-parts.ts";

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

/** 項目を数える一続きの区切り。読点、句点、改行や空白で切る。半角の , と . は数（1,000、12.0）の中にあるので切らない。 */
const STRETCH_END = /[、。，\s]+/u;
/** 長さを比べる最少の項目の数。これより少なければ、語の並びか句の並びか決めない。 */
const MIN_INNER_ITEMS = 3;
/** 項目の字数の中央値がこれを超えれば、語でなく句の並び（オーナーチェンジ物件への回帰・都市部シェア拡大・…）。 */
const MAX_WORD_ITEM_CHARS = 10;

/** 一続きの区切りの中で、前後を中黒で挟まれた項目。最初と最後の項目は、前後の文の語とつながっていて長さが読めないので除く。 */
const innerItems = (text: string, words: readonly string[]): string[] =>
  withoutWordDots(text, words)
    .replace(BULLET_DOT, "$1")
    .split(STRETCH_END)
    .flatMap((stretch) => stretch.split("・").slice(1, -1));

const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

/**
 * 一行に一項目の箇条書きを、変換が一続きにしたもの（＜事業戦略＞・オーナーチェンジ物件への回帰・都市部シェア拡大・…）。
 * 中黒で並べる語（企画・開発・運用）は短く、項目が句の長さなら、中黒は箇条書きの印が行の切れ目を失ったもの。
 */
export const isRunTogetherList = (text: string, words: readonly string[] = []): boolean => {
  const items = innerItems(text, words);
  return items.length >= MIN_INNER_ITEMS && median(items.map((item) => [...item].length)) > MAX_WORD_ITEM_CHARS;
};

/**
 * 中黒で並べると、どこまでが 1 つの項目か分からなくなる。
 * 「企画・開発・運用・保守体制」は、保守体制が 1 つなのか保守と体制なのか読めない。
 * 語彙表（nakaguro-word）の、中黒を含めて 1 語の語（キャッシュ・フロー）の中黒は並べていないので数えない。
 */
export const middleDot: Detector = (doc, options): Finding[] => {
  const words = (options.lexicon ?? []).map((entry) => entry.pattern).toSorted((left, right) => right.length - left.length);
  // 表や箇条書きを変換が一続きにした文（年表の行、一行一項目の箇条書き）は、中黒が並べた語の切れ目か、項目の印か読めない。
  return doc.sentences
    .filter((sentence) => !isFlattenedTable(sentence.text) && !isRunTogetherList(sentence.text, words))
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
