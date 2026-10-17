/**
 * 外のページへのリンクを 1 行に 1 つ並べた一覧（参考の一覧、謝辞）の、リンクの文字。リンク先のページの題名
 * （- [NASA Fprime AI Policy](https://…)、- [User Timing API - Web APIs | MDN](https://…)）で、書き手が展開を書き足せない。
 * 文の中のリンク（following [NIST SP 800-61](https://…), as …）は書き手の言葉なので、略語をそのまま数える。
 * 文書の中や手元のファイルへのリンク（[README](./README.md)）も題名ではない。
 */

type Span = { readonly start: number; readonly end: number };

const EXTERNAL = /^<?https?:\/\//iu;
const TEXT_END = "](";
/** リンクの前に書いてよいもの: 行頭の空白と、箇条書きの印。 */
const LINE_HEAD = /^[ \t]*(?:(?:[-*+]|\d+[.)])[ \t]+)?$/u;
/** リンクの後ろに書いてよいもの: 行末までの空白と句読点。 */
const LINE_TAIL = /^[ \t.,;。、]*(?:\n|$)/u;

/** リンクの文字の範囲。[文字](行き先) の形で、行き先が外のページのものだけ。 */
const externalTextOf = (source: string, link: Span): Span | undefined => {
  const written = source.slice(link.start, link.end);
  const end = written.lastIndexOf(TEXT_END);
  if (!written.startsWith("[") || end === -1 || !EXTERNAL.test(written.slice(end + TEXT_END.length))) return undefined;
  return { start: link.start + 1, end: link.start + end };
};

const standsAlone = (source: string, link: Span): boolean => {
  const lineStart = source.lastIndexOf("\n", link.start - 1) + 1;
  const lineEnd = source.indexOf("\n", link.end);
  const tail = lineEnd === -1 ? source.slice(link.end) : source.slice(link.end, lineEnd + 1);
  return LINE_HEAD.test(source.slice(lineStart, link.start)) && LINE_TAIL.test(tail);
};

/** 1 行に 1 つ並べた外のページへのリンクの、文字の範囲。位置は source の上。 */
export const linkTitleSpans = (source: string, links: readonly Span[]): Span[] =>
  links.flatMap((link) => {
    const text = externalTextOf(source, link);
    return text !== undefined && standsAlone(source, link) ? [text] : [];
  });
