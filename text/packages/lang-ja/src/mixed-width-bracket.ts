/**
 * sentence-splitter は括弧を幅ごとに別の種類として組にする。有価証券報告書の番号「(1）」のように開きが半角・閉じが全角だと、
 * 開いた「(」が節の終わりまで閉じず、その後ろの句点で一度も切れない（節全体が一文になる）。
 *
 * 短い番号の形（開き + 空白も同じ種類の括弧も含まない数文字 + 幅の違う閉じ）に限り、開きを閉じと同じ幅の字に替えて分割器に渡す。
 * 長さが変わらないので、返る span は元の文字列にそのまま当てはまる。幅の混在そのものは bracket-width-consistency が元の文字列で報告する。
 */
// 中身の上限。番号・略号（1、株、注、△、同95.7％）に足りる長さ。長い中身の後の閉じは、別の番号の閉じ（1））かもしれない。
const MARKER_INNER_MAX = 8;

const SHORT_MIXED = [
  { pattern: new RegExp(String.raw`\((?=[^\s()（）]{1,${MARKER_INNER_MAX}}）)`, "gu"), opener: "（" },
  { pattern: new RegExp(String.raw`（(?=[^\s()（）]{1,${MARKER_INNER_MAX}}\))`, "gu"), opener: "(" },
  { pattern: new RegExp(String.raw`\[(?=[^\s[\]［］]{1,${MARKER_INNER_MAX}}］)`, "gu"), opener: "［" },
  { pattern: new RegExp(String.raw`［(?=[^\s[\]［］]{1,${MARKER_INNER_MAX}}\])`, "gu"), opener: "[" },
];

/** 幅の違う閉じで閉じる短い括弧の開きを、閉じと同じ幅に替えた文字列。長さは変わらない。 */
export const pairMixedWidthBrackets = (text: string): string => SHORT_MIXED.reduce((current, { pattern, opener }) => current.replace(pattern, opener), text);
