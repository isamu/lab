import type { Span, Token } from "chaffjs/plugin";

/** start が from 以上になる最初の位置。tokens は start の昇順。 */
const firstFrom = (tokens: readonly Token[], from: number): number => {
  let low = 0;
  let high = tokens.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((tokens[middle]?.span.start ?? Number.POSITIVE_INFINITY) < from) low = middle + 1;
    else high = middle;
  }
  return low;
};

/**
 * span に収まる token。tokens は start の昇順（解析器が本文の頭から出した順）。
 * 文ごとに全 token をなめると、空行の無い何千行もの .txt で文の数 × token の数になる。
 */
export const tokensWithin = (tokens: readonly Token[], span: Span): Token[] => {
  const found: Token[] = [];
  for (let at = firstFrom(tokens, span.start); at < tokens.length; at += 1) {
    const token = tokens[at];
    if (token === undefined || token.span.start > span.end) break;
    if (token.span.end <= span.end) found.push(token);
  }
  return found;
};
