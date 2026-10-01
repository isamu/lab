import type { Detector, Finding, MarkupHeading } from "../plugin.ts";
import { findingAt, writtenHeadings } from "./markup-finding.ts";

/** HTML のコメント（「<!-- 後で書く -->」）。読み手には見えない。一つずつ外す（間の本文ごと一つのコメントと読まない）。 */
const HTML_COMMENT = /<!--[\s\S]*?-->/gu;

/** 後ろに続くものを指すコロン。 */
const LEAD_IN = /[:：]\s*$/u;

const showsNothing = (written: string): boolean => written.replace(HTML_COMMENT, "").trim() === "";

/**
 * 中身の無い節。見出しのすぐ後ろに、同じ深さか浅い見出しが来るもの（remark-lint の no-empty-sections）。
 * 深い見出しが続くのは、節を小さな節に分けただけなので中身がある。文書の最後の見出しは、後ろに何も無ければ空。
 * コロンで終わる見出し（署名欄の「Accepted and agreed to:」）は、後ろの見出しの前置き。
 */
export const emptySections = (source: string, headings: readonly MarkupHeading[]): MarkupHeading[] =>
  headings.filter((heading, index) => {
    const next = headings[index + 1];
    if ((next !== undefined && next.depth > heading.depth) || LEAD_IN.test(heading.text)) return false;
    return showsNothing(source.slice(heading.end, next?.start ?? source.length));
  });

export const emptySection: Detector = (doc): Finding[] =>
  emptySections(doc.source, writtenHeadings(doc)).map((heading) => findingAt(doc, heading, { heading: heading.text }));
