import type { Detector, Finding, MarkupHeading } from "../plugin.ts";
import { findingAt, writtenHeadings } from "./markup-finding.ts";
import { opensSubsection } from "./heading-number.ts";
import { codeFences } from "./code-fences.ts";
import { releasesOf } from "../structure/release-list.ts";

/** HTML のコメント（「<!-- 後で書く -->」）。読み手には見えない。一つずつ外す（間の本文ごと一つのコメントと読まない）。 */
const HTML_COMMENT = /<!--[\s\S]*?-->/gu;

const showsNothing = (written: string): boolean => written.replace(HTML_COMMENT, "").trim() === "";

/**
 * 中身の無い節。見出しのすぐ後ろに、同じ深さか浅い見出しが来るもの（remark-lint の no-empty-sections）。
 * 深い見出しが続くのは、節を小さな節に分けただけなので中身がある。同じ深さでも、番号が節の下の番号（3. の後の 3.1、4. の後の (1)）なら同じ。文書の最後の見出しは、後ろに何も無ければ空。
 */
export const emptySections = (source: string, headings: readonly MarkupHeading[]): MarkupHeading[] =>
  headings.filter((heading, index) => {
    const next = headings[index + 1];
    if (next !== undefined && (next.depth > heading.depth || (next.depth === heading.depth && opensSubsection(heading.text, next.text)))) return false;
    return showsNothing(source.slice(heading.end, next?.start ?? source.length));
  });

/** A changelog's release with nothing to note (one that only promotes its pre-release) is empty by the generator's design. */
export const emptySection: Detector = (doc): Finding[] => {
  const headings = writtenHeadings(doc);
  const releaseStarts = new Set(releasesOf(doc.source, headings, codeFences(doc.source)).map((release) => release.start));
  return emptySections(doc.source, headings)
    .filter((heading) => !releaseStarts.has(heading.start))
    .map((heading) => findingAt(doc, heading, { heading: heading.text }));
};
