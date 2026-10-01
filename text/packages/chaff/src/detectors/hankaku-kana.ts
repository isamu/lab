import type { Detector, Finding, Span } from "../plugin.ts";
import { QUOTATION_MARKS, isWithinAny, quotedSpans } from "../quoted-span.ts";
import { quoteAround } from "./quote-around.ts";

/** 半角の片仮名と、半角の句読点・鉤括弧・中黒・長音・濁点（｡｢｣､･ｰﾞﾟ）。 */
const HALFWIDTH_KANA_RUN = /[\uFF61-\uFF9F]+/gu;

export type HalfwidthRun = { readonly span: Span; readonly written: string };

/** 一行の中の、鉤括弧や引用符で引いたものの位置（行の頭を 0 とする）。引いた名前（「ｶﾅ表示」の画面名）は元の書き方のまま。 */
const quotedOnLine = (source: string, at: number): { readonly lineStart: number; readonly quoted: readonly Span[] } => {
  const lineStart = source.lastIndexOf("\n", at - 1) + 1;
  const lineEnd = source.indexOf("\n", at);
  return { lineStart, quoted: quotedSpans(source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd), QUOTATION_MARKS) };
};

const isQuoted = (source: string, span: Span): boolean => {
  const { lineStart, quoted } = quotedOnLine(source, span.start);
  return isWithinAny(quoted, { start: span.start - lineStart, end: span.end - lineStart });
};

/** 字のまま見える範囲（texts）の中の、半角の片仮名の並び。引いたものの中は数えない。 */
export const halfwidthKanaRuns = (source: string, texts: readonly Span[]): HalfwidthRun[] =>
  texts.flatMap((text) =>
    [...source.slice(text.start, text.end).matchAll(HALFWIDTH_KANA_RUN)]
      .map((match) => ({ span: { start: text.start + match.index, end: text.start + match.index + match[0].length }, written: match[0] }))
      .filter((run) => !isQuoted(source, run.span)),
  );

export const hankakuKana: Detector = (doc): Finding[] =>
  halfwidthKanaRuns(doc.source, doc.markup?.texts ?? []).map(({ span, written }) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(doc.source, span.start, span.end),
    values: { kana: written, fullwidth: written.normalize("NFKC"), offset: span.start },
  }));
