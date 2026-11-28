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

/** 前後の見出しの語のあとに続いてよい区切りか番号（「付録: 用語」「Appendix A」「図1」）。 */
const AFTER_MATTER = /^[\s:：、0-9０-９]/u;

/** 番号を付けない前後の見出し（目次・参考文献・付録 A）か。言葉全体が語彙表の語か、語彙表の語に区切りが続くとき。words は小文字。 */
export const isFrontOrBackMatter = (text: string, words: readonly string[]): boolean => {
  const lowered = text.trim().toLowerCase();
  return words.some((word) => lowered === word || (lowered.startsWith(word) && AFTER_MATTER.test(lowered.slice(word.length))));
};

/**
 * 本題の節から先の、本題と同じ深さか浅い見出しが、どれも前後の見出し（お問合せ先、参考文献）か。それなら文書に本題の見出しは無く、
 * 手紙の形の文書（諮問の文と、末尾の問い合わせ先の囲み）と同じで、見出しの前は前置きではない。words は小文字。
 */
export const hasOnlyMatterHeadings = (sections: readonly Section[], body: Section, words: readonly string[]): boolean =>
  sections
    .slice(sections.indexOf(body))
    .filter((section) => section.depth <= body.depth)
    .every((section) => isFrontOrBackMatter(section.heading, words));
