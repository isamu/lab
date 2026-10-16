import type { Span } from "./plugin.ts";

/** 段落の中の文。listItem は、行頭の印で始まる箇条書きの項目を始める文（adapter が入れる）。 */
type ItemSentence = { readonly span: Span; readonly listItem?: true };

/**
 * 空行を挟まずに行頭の印（①、・、(1)）で項目を並べた段落を、項目ごとの段落に割る。
 * 項目の後ろに続く印の無い行は、その項目の続き。割らないと、項目の並び全体が文の多すぎる 1 つの段落に読まれる。
 *
 * sentences は段落の中の文（並び順）。項目が無ければ paragraph 1 つ。
 */
export const listItemParagraphs = (paragraph: Span, sentences: readonly ItemSentence[]): Span[] => {
  const firsts = sentences.flatMap((sentence, index) => (index === 0 || sentence.listItem === true ? [index] : []));
  if (firsts.length <= 1) return [paragraph];
  return firsts.map((first, index) => {
    const next = firsts[index + 1];
    return {
      start: index === 0 ? paragraph.start : (sentences[first]?.span.start ?? paragraph.start),
      end: next === undefined ? paragraph.end : (sentences[next - 1]?.span.end ?? paragraph.end),
    };
  });
};
