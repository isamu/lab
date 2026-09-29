import type { Span } from "./plugin.ts";

/**
 * 段落の中の改行のうち、読み手には見えないもの。
 *
 * Markdown は段落の中の改行を空白として表示するが、全角の文字に挟まれた改行は空白にもならずに消える
 * （CSS Text 3 の segment break transformation。ブラウザがそう描く）。日本語は語の間に空白を置かないので、
 * PDF から写した判決や、行の途中で折り返して書いた段落をそのまま解析器に渡すと、改行が語を割る（「関」「する」）。
 * 英字・数字・ハングルに接する改行は、読み手にも空白に見えるので残す。
 */
const WIDE = /[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}、-〿！-｠￠-￦]/u;

const NEWLINE = /\n/gu;
const isHorizontalSpace = (unit: string | undefined): boolean => unit === " " || unit === "\t";

/** 改行の前に空白が 2 つ以上あれば、Markdown の強制改行（hard line break）。読み手にも改行に見える。 */
const HARD_BREAK_SPACES = 2;

const isLowSurrogate = (unit: number): boolean => unit >= 0xdc00 && unit <= 0xdfff;

/** index の直前の 1 文字（サロゲートペアは 2 単位で 1 文字）。 */
const charBefore = (text: string, index: number): string => {
  const width = index >= 2 && isLowSurrogate(text.charCodeAt(index - 1)) ? 2 : 1;
  return text.slice(Math.max(0, index - width), index);
};

const charAt = (text: string, index: number): string => {
  const point = text.codePointAt(index);
  return point === undefined ? "" : String.fromCodePoint(point);
};

/** 改行を挟む 2 文字が、改行を消して読む組か。 */
export const joinsAcrossBreak = (before: string, after: string): boolean => WIDE.test(before) && WIDE.test(after);

/** from から back の向きに、空白（スペース・タブ）が続く先。 */
const spacesUntil = (text: string, from: number, step: 1 | -1): number => {
  let at = from;
  while (isHorizontalSpace(text[step === 1 ? at : at - 1])) at += step;
  return at;
};

/** 改行 1 つと、その前の行末・後ろの行頭の空白。正規表現で取ると、空白の長い並びで後戻りが増える。 */
const lineBreakAt = (text: string, newline: number): { readonly span: Span; readonly trailingSpaces: number } => {
  const lineEnd = text[newline - 1] === "\r" ? newline - 1 : newline;
  const start = spacesUntil(text, lineEnd, -1);
  return { span: { start, end: spacesUntil(text, newline + 1, 1) }, trailingSpaces: lineEnd - start };
};

const isSoft = (text: string, found: { readonly span: Span; readonly trailingSpaces: number }): boolean =>
  found.trailingSpaces < HARD_BREAK_SPACES && joinsAcrossBreak(charBefore(text, found.span.start), charAt(text, found.span.end));

/** text の中の、消える改行（前後の行頭・行末の空白ごと）。text の文字だけで決める。 */
export const softBreaks = (text: string): Span[] =>
  [...text.matchAll(NEWLINE)]
    .map((match) => lineBreakAt(text, match.index))
    .filter((found) => isSoft(text, found))
    .map((found) => found.span);

/**
 * 覆った文字（コード・リンクの記号・URL）に触れない、消える改行。source と prose は同じ長さで、同じ位置に同じ文字がある。
 *
 * 覆った文字は空白になっているので、prose だけでは行頭のインデントとインラインコードの跡を見分けられない。
 * 見分けずにつなぐと、行頭の `npm` の前後の語が 1 語になる。
 */
export const unmaskedSoftBreaks = (source: string, prose: string): Span[] =>
  softBreaks(prose).filter((span) => source.slice(span.start, span.end) === prose.slice(span.start, span.end));

/** breaks（text の中の範囲、昇順・重ならない）を取り除いた文字列。 */
export const withoutSpans = (text: string, breaks: readonly Span[]): string => {
  const parts: string[] = [];
  const cursor = breaks.reduce((from, span) => {
    parts.push(text.slice(from, span.start));
    return span.end;
  }, 0);
  parts.push(text.slice(cursor));
  return parts.join("");
};

/** sorted（昇順・重ならない）の中で、end が offset より後ろの最初の添字。無ければ sorted.length。 */
export const firstEndingAfter = (sorted: readonly Span[], offset: number): number => {
  const search = (low: number, high: number): number => {
    if (low >= high) return low;
    const middle = (low + high) >> 1;
    return (sorted[middle]?.end ?? Number.POSITIVE_INFINITY) > offset ? search(low, middle) : search(middle + 1, high);
  };
  return search(0, sorted.length);
};

/** sorted（昇順・重ならない）のうち、outer に収まるもの。段落や文ごとに全部をなめない。 */
export const spansWithin = <T extends Span>(sorted: readonly T[], outer: Span): T[] => {
  const from = firstEndingAfter(sorted, outer.start);
  const to = firstEndingAfter(sorted, outer.end);
  return sorted.slice(from, to).filter((span) => span.start >= outer.start);
};
