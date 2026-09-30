import type { Section } from "./plugin.ts";

/**
 * 本題の始まり: 最初の中見出し（深さ 2 以上）の節。表題（深さ 1）の直後から数えると、表題しか無い文書で全文が前置きになる。
 * 無ければ、本題の前を測る rule は動けない（rule の requires の headings）。
 */
export const bodySectionOf = (sections: readonly Section[]): Section | undefined => sections.find((section) => section.depth >= 2);
