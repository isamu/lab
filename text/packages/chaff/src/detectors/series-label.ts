/**
 * - で区切った文書番号のすぐ前の大文字の語（NIST SP 800-61 の SP、NSF 19-582、IEC 19757-2）。番号の一部で、略語ではない。
 * 空白で離して書くほかは、- で繋いだ識別子（AC-2）と同じ。番号の直前の 1 語だけで、その前の語（NIST）は略語のまま数える。
 * 区切りの無い番号（RFC 9110）、. で区切る版（SDK 3.1）、年の範囲（FY 2024-25）の前の語も略語のまま数える。
 */

type Span = { readonly start: number; readonly end: number };

const YEAR_RANGE = String.raw`(?:19|20)\d\d-\d`;
const SERIES_LABEL = new RegExp(String.raw`(?<![A-Za-z0-9_&.-])[A-Z]+ (?!${YEAR_RANGE})(?<number>\d+(?:-\d+)+)[A-Za-z0-9]*(?![A-Za-z0-9_&-])`, "gu");

/**
 * 文書番号は長い通し番号を持つ（800-61、19757-2）。2 桁ずつの番号（BOD 25-01）は範囲・得点・日付（SRE 1-2、NFL 3-1、
 * 01-02）と見分けられないので、その前の語は略語のまま数える。同じ桁数で小さいほうから書いた 2 つの数（SLO 100-200、
 * SLA 500-599）は範囲。
 */
const SERIAL_DIGITS = 3;

const isRange = (groups: readonly string[]): boolean => {
  const [low, high, ...rest] = groups;
  return rest.length === 0 && low !== undefined && high !== undefined && low.length === high.length && Number(low) < Number(high);
};

const isDocumentNumber = (number: string): boolean => {
  const groups = number.split("-");
  return groups.some((group) => group.length >= SERIAL_DIGITS) && !isRange(groups);
};

/** 文の中の、番号と、その前の大文字の語の範囲。 */
export const seriesLabelSpans = (text: string): Span[] =>
  [...text.matchAll(SERIES_LABEL)]
    .filter((match) => isDocumentNumber(match.groups?.["number"] ?? ""))
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));
