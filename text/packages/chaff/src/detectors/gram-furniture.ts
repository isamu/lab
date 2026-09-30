import type { Span } from "../plugin.ts";

// ひな形が項目ごとに繰り返す飾り（一覧の札、リンクの文字、記号の並び）。書き手の言い回しではない。

const MARK = /[\p{P}\p{S}]/gu;

const BRACKETED = /[([{（［｛]([^()[\]{}（）［］｛｝]*)[)\]}）］｝]/gu;

/** 札の 1 項目。空白を含まない 1 語で、平仮名も含まない（日本語で平仮名を含めば、括弧の中は言い回し）。 */
const TAG_ITEM = /^\s*[^\s\p{Script=Hiragana}]+\s*$/u;

/** 括弧の中が、1 語か 1 語ずつの並び（(replaced)、[pdf, html, other]）。(if applicable) のような句は札ではない。 */
const isTag = (inside: string): boolean => inside.split(/[,、]/u).every((item) => TAG_ITEM.test(item));

const spansOf = (text: string, pattern: RegExp, keep: (match: RegExpExecArray) => boolean): Span[] =>
  [...text.matchAll(pattern)].filter(keep).map((match) => ({ start: match.index, end: match.index + match[0].length }));

/** text の各位置（UTF-16 の単位）が飾りか。記号・句読点、括弧でくくった札、リンクの文字（linked が決める）。 */
export const furnitureMask = (text: string, linked: (index: number) => boolean): boolean[] => {
  const mask = Array.from({ length: text.length }, (_, index) => linked(index));
  [...spansOf(text, MARK, () => true), ...spansOf(text, BRACKETED, (match) => isTag(match[1] ?? ""))].forEach((span) => mask.fill(true, span.start, span.end));
  return mask;
};

/** 窓の中の空白でない文字の過半が飾りなら、その出現は飾り。 */
export const isFurniture = (text: string, mask: readonly boolean[], window: Span): boolean => {
  const visible = Array.from({ length: window.end - window.start }, (_, step) => window.start + step).filter((index) => !/\s/u.test(text[index] ?? ""));
  const marked = visible.filter((index) => mask[index] === true);
  return visible.length > 0 && marked.length * 2 > visible.length;
};
