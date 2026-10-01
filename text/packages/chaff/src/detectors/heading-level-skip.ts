import type { Detector, Finding, MarkupHeading } from "../plugin.ts";
import { findingAt, markupOf } from "./markup-finding.ts";

export type SkippedHeading = { readonly heading: MarkupHeading; readonly from: number };

/**
 * 一つ前の見出しより二段以上深い見出し（## の次の ####）。最初の見出しは何段から始めてもよい。
 * 飛んだ後は、飛んだ先の深さを基準にする（#### の次の #### は飛んでいない）。markdownlint の MD001 と同じ数え方。
 */
export const skippedHeadings = (headings: readonly MarkupHeading[]): SkippedHeading[] =>
  headings.flatMap((heading, index) => {
    const previous = headings[index - 1];
    return previous !== undefined && heading.depth > previous.depth + 1 ? [{ heading, from: previous.depth }] : [];
  });

export const headingLevelSkip: Detector = (doc): Finding[] =>
  skippedHeadings(markupOf(doc)?.headings ?? []).map(({ heading, from }) =>
    findingAt(doc, heading, { heading: heading.text, from, to: heading.depth, expected: from + 1 }),
  );
