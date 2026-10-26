import type { Detector, Finding, MarkupHeading } from "../plugin.ts";
import { findingAt, markupOf } from "./markup-finding.ts";

export type SkippedHeading = { readonly heading: MarkupHeading; readonly from: number };

/** 「1 」「2.1 」「4.2.1. 」のような節番号で始まる見出し。全角の数字と句点も数える。 */
const SECTION_NUMBER = /^([0-9０-９]{1,3}(?:[.．][0-9０-９]{1,3})*)[.．]?\s/u;
const NUMBERED_OUTLINE_MIN_HEADINGS = 3;

/** 節番号の桁の数（「2.1」は 2）。番号で始まらない見出しは 0。 */
const numberParts = (heading: MarkupHeading): number => SECTION_NUMBER.exec(heading.text.trim())?.[1]?.split(/[.．]/u).length ?? 0;

const isNumbered = (heading: MarkupHeading): boolean => numberParts(heading) > 0;

/** 桁の多い番号ほど深い段にある（「1」の下に「1.1」）。版番号「1.0.0」が並ぶだけの変更履歴は入れ子ではない。 */
const isNestedNumbering = (numbered: readonly MarkupHeading[]): boolean =>
  numbered.some((outer) => numbered.some((inner) => numberParts(inner) > numberParts(outer) && inner.depth > outer.depth));

/** 節番号が入れ子で振られた文書で、番号の付いた見出しのうち一番深い段。そうでない文書は undefined。 */
const deepestNumberedDepth = (headings: readonly MarkupHeading[]): number | undefined => {
  const numbered = headings.filter(isNumbered);
  return numbered.length >= NUMBERED_OUTLINE_MIN_HEADINGS && isNestedNumbering(numbered) ? Math.max(...numbered.map((heading) => heading.depth)) : undefined;
};

/**
 * 文書の骨組みになる見出し。文字の無い見出し（プレスリリースの終わりの印「###」）は見出しではない。
 * 節番号が入れ子で振られた文書では番号が骨組みなので、一番深い番号より深い番号無しの見出しは段落の頭の小見出し
 * （LaTeX の \paragraph、論文の HTML が h6 にする「Abstract」）で、深さを比べない。
 */
export const outlineHeadings = (headings: readonly MarkupHeading[]): MarkupHeading[] => {
  const titled = headings.filter((heading) => heading.text.trim() !== "");
  const deepest = deepestNumberedDepth(titled);
  return deepest === undefined ? titled : titled.filter((heading) => heading.depth <= deepest || isNumbered(heading));
};

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
  skippedHeadings(outlineHeadings(markupOf(doc)?.headings ?? [])).map(({ heading, from }) =>
    findingAt(doc, heading, { heading: heading.text, from, to: heading.depth, expected: from + 1 }),
  );
