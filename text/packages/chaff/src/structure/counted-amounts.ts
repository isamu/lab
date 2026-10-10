import type { Amount } from "./total.ts";

/**
 * 数を足してよい助数詞（16単位、4コマ、3 credits）が付いた数。解析器が助数詞と読まない語（単位、コマ）もここで数量にする。
 * 助数詞の語は total-mismatch の語彙表（summed-counter）から取る。同じ組（group）の語（credit と credits）は同じ単位として足す。
 */
export type SummedCounter = { readonly pattern: string; readonly unit: string };

/** 前に英字や数や小数点が続く数（v2、A4、1.2.3 の 2）は読まない。日本語は数の前に空白を置かないので、仮名や漢字の後ろはよい。 */
export const NUMBER = /(?<![\p{Script=Latin}\p{N}.,．，])[0-9０-９]+(?:[,，][0-9０-９]{3})*(?:[.．][0-9０-９]+)?/gu;

/** 助数詞に文字や数、つなぎの - _ が詰めて続くもの（3単位目、4コマ漫画、3 unit-priced）は、別の語の一部。 */
export const CONTINUES_WORD = /^[\p{L}\p{N}_-]/u;

/** 序数の印（第3回）。 */
const ORDINAL_MARK = "第";

/** 助数詞を探す長さ。どの助数詞よりも長い。 */
const LOOKAHEAD = 32;

export const valueOf = (written: string): number => Number(written.normalize("NFKC").replace(/,/gu, ""));

/** 数のすぐ後ろ（空白一つまで）の助数詞。長い語から試す。大文字小文字は区別しない（4 Credits）。 */
const counterAfter = (source: string, end: number, counters: readonly SummedCounter[]): { unit: string; end: number } | undefined => {
  const gap = source.charAt(end) === " " ? 1 : 0;
  const rest = source.slice(end + gap, end + gap + LOOKAHEAD).toLowerCase();
  const counter = counters.find((candidate) => rest.startsWith(candidate.pattern.toLowerCase()) && !CONTINUES_WORD.test(rest.slice(candidate.pattern.length)));
  return counter === undefined ? undefined : { unit: counter.unit, end: end + gap + counter.pattern.length };
};

export const overlapsAny = (start: number, end: number, amounts: readonly Amount[]): boolean =>
  amounts.some((amount) => start < amount.end && amount.offset < end);

/** 文書の中の、足してよい助数詞の付いた数。木がすでに数量として読んだもの（known）とは重ねない。 */
export const countedAmounts = (source: string, counters: readonly SummedCounter[], known: readonly Amount[]): Amount[] => {
  const longestFirst = counters.toSorted((left, right) => right.pattern.length - left.pattern.length);
  return [...source.matchAll(NUMBER)].flatMap((match): Amount[] => {
    if (source.charAt(match.index - 1) === ORDINAL_MARK) return [];
    const found = counterAfter(source, match.index + match[0].length, longestFirst);
    if (found === undefined || overlapsAny(match.index, found.end, known)) return [];
    return [{ offset: match.index, end: found.end, value: valueOf(match[0]), unit: found.unit }];
  });
};
