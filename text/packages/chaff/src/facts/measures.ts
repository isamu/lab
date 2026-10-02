import type { FactValue } from "./fact-values.ts";

/**
 * 単位の付いた量（5 km、3000 m、1.5時間、2 GB）。単位は言語パッケージの語彙表から取り、量の種類（長さ、重さ…）と、基準の単位への
 * 倍率を持つ。倍率が二つある単位（1 GB は 10^9 か 2^30 バイト）は、どちらで数えても合えば合う。
 */
export type MeasureUnit = { readonly pattern: string; readonly dimension: string; readonly factors: readonly number[] };

export type Measured = FactValue & { readonly dimension: string; readonly factors: readonly number[]; readonly amount: number };

/** 前に英字や数が続く数（v2、A4、1.2.3 の 2）は量ではない。日本語は数の前に空白を置かないので、仮名や漢字の後ろはよい。 */
const NUMBER = /(?<![\p{Script=Latin}\p{N}.,])[0-9０-９]+(?:[,，][0-9０-９]{3})*(?:[.．][0-9０-９]+)?/gu;

/**
 * 数のすぐ後ろ（空白一つまで）の単位。長い単位から試す（「5分間」を 分 で切らない、min を m にしない）。
 * 単位の後ろに語が続く（5 miners）ものは、名前付きの値の終わり（fact-value-end）で落ちるので、ここでは見ない。
 */
const unitAfter = (source: string, end: number, units: readonly MeasureUnit[]): { unit: MeasureUnit; end: number } | undefined => {
  const gap = source.charAt(end) === " " ? 1 : 0;
  const rest = source.slice(end + gap, end + gap + 16);
  const unit = units.find((candidate) => rest.startsWith(candidate.pattern));
  return unit === undefined ? undefined : { unit, end: end + gap + unit.pattern.length };
};

/** 文書の中の、単位の付いた量。 */
export const measuredValues = (source: string, units: readonly MeasureUnit[]): Measured[] => {
  const longestFirst = units.toSorted((left, right) => right.pattern.length - left.pattern.length);
  return [...source.matchAll(NUMBER)].flatMap((match): Measured[] => {
    const found = unitAfter(source, match.index + match[0].length, longestFirst);
    if (found === undefined) return [];
    const amount = Number(match[0].normalize("NFKC").replace(/,/gu, ""));
    return [
      {
        start: match.index,
        end: found.end,
        kind: "quantity",
        key: String(amount),
        unit: found.unit.pattern,
        dimension: found.unit.dimension,
        factors: found.unit.factors,
        amount,
      },
    ];
  });
};

/** 二つの量が同じ量か。倍率のどの組み合わせかで、基準の単位に直した値の差が大きいほうの tolerance 以内なら同じ。 */
export const sameMeasure = (left: Measured, right: Measured, tolerance: number): boolean =>
  left.factors.some((a) =>
    right.factors.some((b) => {
      const [x, y] = [left.amount * a, right.amount * b];
      return Math.abs(x - y) <= Math.max(Math.abs(x), Math.abs(y)) * tolerance;
    }),
  );
