/**
 * 崩れのない書き方のローマ数字（I〜MMMM）。IIII や VX は数として書かれないので、略語の側に残す。
 * 各桁が省けるので空文字にも当たる。1 文字目があることを先読みで求める。
 */
export const ROMAN_NUMERAL = "(?=[MDCLXVI])M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})";

/** ハイフンかダッシュで繋いだ数字の範囲（II-VI、I–III）も、一つの番号として読む。 */
export const romanRangeOf = (numeral: string): string => `${numeral}(?:[-–]${numeral})?`;
