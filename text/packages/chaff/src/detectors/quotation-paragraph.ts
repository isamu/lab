import type { Span } from "../plugin.ts";

/** Markdown の > か、引用の字を書き替えた角括弧の大文字（[T]he guard, …）で始まる段落。 */
const MARKED_QUOTATION = /^(?:>|\[\p{Lu}\]\p{Ll})/u;
/** 小文字だけの語で始まる段落（that concrete adverseness which …）。大文字を含む語（iOS、macOS）は名前。 */
const LOWERCASE_OPENING = /^\p{Ll}+[\s,;:]/u;
/** 文の終わりの印を持たずに終わる段落（This setting assures there is）。 */
const OPEN_ENDING = /\p{L}$/u;

/**
 * 段落が、引用を地の文から切り出して置いた段落（ブロック引用）と読めるか。字下げを失ったテキストでも形で分かる: > の段落、
 * 角括弧の書き替えで始まる段落と、前の段落の文が終わらないまま小文字の語で続く段落（…assures there is ／ that concrete
 * adverseness which …）。前の段落が文を閉じていれば、小文字の段落は書き手の文（see the file which …）として読む。
 */
export const isQuotationParagraph = (paragraph: string, previous: string): boolean => {
  const text = paragraph.trimStart();
  return MARKED_QUOTATION.test(text) || (LOWERCASE_OPENING.test(text) && OPEN_ENDING.test(previous.trimEnd()));
};

/** ブロック引用と読める段落の番号（paragraphs の中の位置）。 */
export const quotationParagraphIndexes = (source: string, paragraphs: readonly Span[]): ReadonlySet<number> =>
  new Set(
    paragraphs.flatMap((paragraph, index) => {
      const before = paragraphs[index - 1];
      const previous = before === undefined ? "" : source.slice(before.start, before.end);
      return isQuotationParagraph(source.slice(paragraph.start, paragraph.end), previous) ? [index] : [];
    }),
  );
