import type { Detector, Finding, Lexicon, MarkupHeading, ProseDocument } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { findingAt, writtenHeadings } from "./markup-finding.ts";

/**
 * 札と番号だけの見出し（メリット1、ポイント2、Benefit 3）。目次を見ても、節に何が書いてあるかが分からない。
 * 札は語彙表 generic-heading-label が言う。題を足した見出し（メリット1：設定が要らない）は読まない。
 */

/** 番号の書き方。数字、丸数字、漢数字。前に「その」や「#」、後ろに区切りの記号が付いてもよい。 */
const NUMBER = String.raw`(?:その)?\s*#?\s*[(（]?\s*(?:[0-9０-９]+|[①-⑳]|[一二三四五六七八九十]+)\s*(?:つ目)?\s*[:：.．。)）]?`;

/** 札のどれかと番号だけで書いた見出しの形。札が無ければ undefined。 */
export const bareLabelPattern = (labels: Lexicon): RegExp | undefined => {
  const words = labels.map((entry) => escapeRegExp(entry.pattern)).filter((word) => word !== "");
  return words.length === 0 ? undefined : new RegExp(`^(?:${words.join("|")})\\s*${NUMBER}$`, "iu");
};

/** 札と番号だけの見出し。 */
export const bareLabelHeadings = (doc: ProseDocument): MarkupHeading[] => {
  const pattern = bareLabelPattern(doc.lexicons["generic-heading-label"] ?? []);
  return pattern === undefined ? [] : writtenHeadings(doc).filter((heading) => pattern.test(heading.text.trim()));
};

/** 数で見る。一つなら書き手の選び方、並べば型をなぞった見出し。 */
export const genericHeading: Detector = (doc, options): Finding[] => {
  const bare = bareLabelHeadings(doc);
  if (bare.length === 0 || bare.length < options.limit) return [];
  return bare.map((heading) => findingAt(doc, heading, { heading: heading.text.trim(), count: bare.length, limit: options.limit }));
};
