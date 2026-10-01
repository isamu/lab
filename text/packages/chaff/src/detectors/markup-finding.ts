import type { Finding, Markup, ProseDocument, Span } from "../plugin.ts";

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
