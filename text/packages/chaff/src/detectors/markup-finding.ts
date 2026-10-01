import type { Finding, Markup, MarkupHeading, ProseDocument, Span } from "../plugin.ts";
import { hasTitle } from "../heading-title.ts";

// 記法の rule（見出し・画像・リンク・URL）が指摘を作る形。

/** 引いて見せる記法の長さの上限。長い URL をまるごと見せても、どこが悪いかは伝わらない。 */
const QUOTE_LIMIT = 80;

export const quoteOf = (source: string, span: Span): string => {
  const written = source.slice(span.start, span.end).replace(/\s+/gu, " ").trim();
  return written.length > QUOTE_LIMIT ? `${written.slice(0, QUOTE_LIMIT)}…` : written;
};

export const findingAt = (doc: ProseDocument, span: Span, values: Readonly<Record<string, string | number>>, variant?: string): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: quoteOf(doc.source, span),
  values: { ...values, offset: span.start },
  ...(variant === undefined ? {} : { variant }),
});

/** Markdown の文書の記法。Markdown でなければ undefined。 */
export const markupOf = (doc: ProseDocument): Markup | undefined => (doc.markup?.markdown === true ? doc.markup : undefined);

/** 文の終わりの句点。下線で書く見出し（setext）の言葉がこれで終わるなら、区切り線の上の文。 */
const SENTENCE_END = /[.。!?！？]$/u;

/**
 * 下線で書く見出し（setext）のうち、区切り線（メールの「-----」）の上の段落を Markdown が見出しと読んだもの。
 * 二行以上にわたるか、句点で終わる。書き手は見出しを立てていない。
 */
const isUnderlinedParagraph = (source: string, heading: MarkupHeading): boolean =>
  !source.startsWith("#", heading.start) && (heading.text.includes("\n") || SENTENCE_END.test(heading.text));

/** 見出しとして書いた見出し。題の無い見出し（`## ---`）と、区切り線の上の段落は外す。 */
export const writtenHeadings = (doc: ProseDocument): MarkupHeading[] =>
  (markupOf(doc)?.headings ?? []).filter((heading) => hasTitle(heading.text) && !isUnderlinedParagraph(doc.source, heading));
