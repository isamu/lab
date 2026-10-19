import type { Span } from "./plugin.ts";

/**
 * 文の頭で、丸括弧に語を一つ入れた印（問答の（問）（答）、（注）（例））。印は決まった略した形で、本文のその語の書き方
 * （答え、注意）とは比べない。括弧の中は字と数字だけで、句読点や空白、ほかの括弧があれば印と読まない。
 */
const LEADING_LABEL = /^([ \t\u3000]*)([（(][\p{L}\p{N}]{1,4}[）)])/u;

/** text の頭の印の範囲。印が無ければ空。 */
export const leadingLabelSpans = (text: string): Span[] => {
  const match = LEADING_LABEL.exec(text);
  const [lead, label] = [match?.[1], match?.[2]];
  if (lead === undefined || label === undefined) return [];
  return [{ start: lead.length, end: lead.length + label.length }];
};
