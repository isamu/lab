import { oneOf } from "./acronym-name.ts";

/**
 * 巻の番号と区分で引く法令集の名前（21 CFR subpart J、21 CFR chapter I、40 CFR subchapter C）。巻の番号の後ろの名前に、
 * 区分の語と、その番号（数字、ローマ数字、1 文字の大文字）が続く形だけ。語は語彙表 citation-series から読む。区分の番号が続かない所
 * （The 2 CFR export was generated）は法令集そのものを言うので、略語のまま数える。
 */

type Span = { readonly start: number; readonly end: number };

const TITLE_NUMBER = String.raw`(?<![\p{L}\p{N}_.,])\d{1,3}[ \t]+`;
const DIVISION = String.raw`[ \t]+\p{L}+\.?[ \t]+`;
const DESIGNATOR = String.raw`(?:\d|[IVXLC]+(?![\p{L}\p{N}])|\p{Lu}(?![\p{L}\p{N}]))`;

export const titledCodeSpans = (text: string, series: readonly string[]): Span[] => {
  if (series.length === 0) return [];
  const pattern = new RegExp(String.raw`(?<=${TITLE_NUMBER})${oneOf(series)}(?=${DIVISION}${DESIGNATOR})`, "gu");
  return [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
};
