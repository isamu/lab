import type { Detector, Finding, MarkupHeading } from "../plugin.ts";
import { findingAt, markupOf } from "./markup-finding.ts";

/** HTML のコメント（「<!-- 後で書く -->」）。読み手には見えない。一つずつ外す（間の本文ごと一つのコメントと読まない）。 */
const HTML_COMMENT = /<!--[\s\S]*?-->/gu;

const showsNothing = (written: string): boolean => written.replace(HTML_COMMENT, "").trim() === "";

/**
 * 中身の無い節。見出しのすぐ後ろに、同じ深さか浅い見出しが来るもの（remark-lint の no-empty-sections）。
 * 深い見出しが続くのは、節を小さな節に分けただけなので中身がある。文書の最後の見出しは、後ろに何も無ければ空。
 */
export const emptySections = (source: string, headings: readonly MarkupHeading[]): MarkupHeading[] =>
  headings.filter((heading, index) => {
    const next = headings[index + 1];
    if (next !== undefined && next.depth > heading.depth) return false;
    return showsNothing(source.slice(heading.end, next?.start ?? source.length));
  });

export const emptySection: Detector = (doc): Finding[] =>
  emptySections(doc.source, markupOf(doc)?.headings ?? []).map((heading) => findingAt(doc, heading, { heading: heading.text }));
