/**
 * - で区切った番号のすぐ前の大文字の語（NIST SP 800-61 の SP、BOD 25-01、NSF 19-582）。文書番号の一部で、略語ではない。
 * 空白で離して書くほかは、- で繋いだ識別子（AC-2）と同じ。番号の直前の 1 語だけで、その前の語（NIST）は略語のまま数える。
 * 区切りの無い番号（RFC 9110）、. で区切る版（SDK 3.1）、年の範囲（FY 2024-25）の前の語も略語のまま数える。
 */

type Span = { readonly start: number; readonly end: number };

const YEAR_RANGE = String.raw`(?:19|20)\d\d-\d`;
const SERIES_LABEL = new RegExp(String.raw`(?<![A-Za-z0-9_&.-])[A-Z]+ (?!${YEAR_RANGE})\d+(?:-\d+)+[A-Za-z0-9]*(?![A-Za-z0-9_&-])`, "gu");

/** 文の中の、番号と、その前の大文字の語の範囲。 */
export const seriesLabelSpans = (text: string): Span[] =>
  [...text.matchAll(SERIES_LABEL)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
