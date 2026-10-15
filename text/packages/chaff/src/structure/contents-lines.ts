import type { MarkupHeading } from "../plugin.ts";
import { lineNumberAt, type Line } from "./lines.ts";

// 目次・索引の行と、番号に題だけを続けた行。どれも本文の文ではなく、文書の案内。純関数: 行と Markdown の見出しを受け取る。

/** 項目の終わり（ページ番号、条の番地 2.04(c)）の後ろに、次の項目の大文字が続く所。 */
const ENTRY_BREAK = /(?<![\p{L}\p{N}$.,])\d+(?:\.\d+)*(?:\([\p{L}\p{N}]{1,4}\))*\s+(?=\p{Lu})/gu;
/** 一行に詰めた目次・索引と読むのに要る、項目の切れ目の数（Closing 2 Section 1.2 The Merger 2 ARTICLE II）。 */
const MIN_ENTRY_BREAKS = 3;
/** 目次・索引の行の言葉は、ほとんどが大文字で始まる。短くない語のうち小文字で始まる語がこの割合以上なら文。 */
const MAX_LOWERCASE_SHARE = 1 / 3;
/** これより短い語（of、and、the、番地の (c)、iii）は、題の中でも小文字で書く。 */
const MIN_CAPITALISED_LENGTH = 4;
const WORD = /\p{L}[\p{L}'’-]*/gu;
const LOWERCASE_START = /^\p{Ll}/u;

/** 短くない語のうち、小文字で始まる語の割合。 */
const lowercaseShare = (text: string): number => {
  const words = (text.match(WORD) ?? []).filter((word) => word.length >= MIN_CAPITALISED_LENGTH);
  return words.length === 0 ? 1 : words.filter((word) => LOWERCASE_START.test(word)).length / words.length;
};

/** 項目と番号を一行に詰めた目次・索引（Section 1.1 Closing 2 Section 1.2 The Merger 2、Company RSU 2.04(b) Company SEC Documents 4.07(a)）。 */
const isPackedContents = (text: string): boolean => [...text.matchAll(ENTRY_BREAK)].length >= MIN_ENTRY_BREAKS && lowercaseShare(text) < MAX_LOWERCASE_SHARE;

/** 番号に題を続けただけの行（1 Supply of Ingredients）。題の語は大文字で始まり、文の終わりの印を持たない。 */
const NUMBERED_TITLE = /^\s*\d+(?:\.\d+)*\.?\s+\p{Lu}[^.。:;,!?]*$/u;
/** 題と読む語の数の上限。 */
const MAX_TITLE_WORDS = 8;

const NOT_LATIN_LETTER = /[^\P{L}\p{Script=Latin}]/u;

/** 英語の題の言葉か: 語が多すぎず、短くない語がどれも大文字で始まる（Supply of Ingredients、Extension; Waiver）。 */
export const isTitleWords = (text: string): boolean => {
  const words = text.match(WORD) ?? [];
  return (
    words.length > 0 &&
    !NOT_LATIN_LETTER.test(text) &&
    words.length <= MAX_TITLE_WORDS &&
    words.every((word) => word.length < MIN_CAPITALISED_LENGTH || !LOWERCASE_START.test(word))
  );
};

const isNumberedTitle = (text: string): boolean => NUMBERED_TITLE.test(text) && isTitleWords(text);

/** 目次の見出し（語彙表 toc-heading）の下、次の見出しまでの行の番号。 */
const linesUnderContentsHeading = (lines: readonly Line[], headings: readonly MarkupHeading[], tocWords: readonly string[]): number[] => {
  const names = new Set(tocWords.map((word) => word.toLowerCase()));
  return headings.flatMap((heading, index) => {
    if (!names.has(heading.text.trim().toLowerCase())) return [];
    const from = lineNumberAt(lines, heading.start) ?? 0;
    const next = headings[index + 1];
    const to = next === undefined ? lines.length + 1 : (lineNumberAt(lines, next.start) ?? lines.length + 1);
    return lines.filter((line) => line.number > from && line.number < to).map((line) => line.number);
  });
};

/** 目次・索引の行と、番号に題だけを続けた行の番号（1 始まり）。 */
export const contentsLineNumbers = (lines: readonly Line[], headings: readonly MarkupHeading[], tocWords: readonly string[]): ReadonlySet<number> =>
  new Set([
    ...linesUnderContentsHeading(lines, headings, tocWords),
    ...lines.filter((line) => isPackedContents(line.text) || isNumberedTitle(line.text)).map((line) => line.number),
  ]);
