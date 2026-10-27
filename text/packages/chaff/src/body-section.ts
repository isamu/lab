import type { Section } from "./plugin.ts";

/** 何行にも渡る深さ 1 の見出しは、罫線（=====）の上の段落を Setext の見出しと読んだもので、節の始まりではない。 */
const isSiblingSection = (section: Section, index: number, titleIndex: number): boolean =>
  section.depth === 1 && index > titleIndex && !section.heading.includes("\n");

/**
 * 本題の始まり: 最初の中見出し（深さ 2 以上）の節か、表題と同じ深さ 1 の二つ目の見出しの、先に来る方。
 * 表題（最初の深さ 1）の直後から数えると、表題しか無い文書で全文が前置きになる。節をすべて深さ 1 で書く文書
 * （官報の AGENCY: / ACTION: / SUMMARY:）では、二つ目の深さ 1 が最初の節で、その後ろは前置きではない。
 * 無ければ、本題の前を測る rule は動けない（rule の requires の headings）。
 */
export const bodySectionOf = (sections: readonly Section[]): Section | undefined => {
  const titleIndex = sections.findIndex((section) => section.depth === 1);
  return sections.find((section, index) => section.depth >= 2 || isSiblingSection(section, index, titleIndex));
};
