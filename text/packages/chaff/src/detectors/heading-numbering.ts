import type { Detector, Finding, LexiconEntry } from "../plugin.ts";
import { findingAt, writtenHeadings } from "./markup-finding.ts";
import { numberingMinorities, numberingStyleOf, UNNUMBERED, type NumberingMinority, type NumberLabel } from "../heading-numbering.ts";

const labelsOf = (entries: readonly LexiconEntry[]): NumberLabel[] =>
  entries.map((entry) => ({ word: entry.pattern, position: entry.position === "after" ? "after" : "before" }));

/** 前後の見出しの語のあとに続いてよい区切り（「付録: 用語」「Appendix A」）。 */
const AFTER_MATTER = /^[\s:：、]/u;

/** 番号を付けない前後の見出し（目次・参考文献・付録 A）か。言葉全体が語彙表の語か、語彙表の語に区切りが続くとき。 */
const isFrontOrBackMatter = (text: string, words: readonly string[]): boolean => {
  const lowered = text.trim().toLowerCase();
  return words.some((word) => lowered === word || (lowered.startsWith(word) && AFTER_MATTER.test(lowered.slice(word.length))));
};

const variantOf = (minority: NumberingMinority): string => {
  if (minority.kind === "style") return "style";
  return minority.majority === UNNUMBERED ? "numbered" : "unnumbered";
};

/**
 * 兄弟の見出し（同じ親の下の同じ深さ）で、番号を付けたものと付けないもの、番号の書き方（1. と 1）と 第1章）が混ざっている所。
 * 少ないほうを指す。どの語が番号を持つか（第1章、Chapter 1）は語彙表 heading-number-label、番号を付けない前後の見出しは unnumbered-heading が言う。
 */
export const headingNumbering: Detector = (doc): Finding[] => {
  const headings = writtenHeadings(doc);
  const labels = labelsOf(doc.lexicons["heading-number-label"] ?? []);
  const matter = (doc.lexicons["unnumbered-heading"] ?? []).map((entry) => entry.pattern.toLowerCase());
  const styles = headings.map((heading) => numberingStyleOf(heading.text, labels));
  const read = headings.map((heading, at) => ({ depth: heading.depth, style: styles[at] ?? UNNUMBERED, skipped: isFrontOrBackMatter(heading.text, matter) }));
  return numberingMinorities(read).flatMap((minority) => {
    const heading = headings[minority.at];
    if (heading === undefined) return [];
    const values = { heading: heading.text.trim(), count: minority.count, example: headings[minority.example]?.text.trim() ?? "" };
    return [findingAt(doc, heading, values, variantOf(minority))];
  });
};
