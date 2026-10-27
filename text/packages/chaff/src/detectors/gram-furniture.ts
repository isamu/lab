import type { LengthUnit, Span } from "../plugin.ts";

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

/**
 * 文の終わりの決まった結び（通知が法令の改正点を並べる「〜ものとすること。」）の範囲。項目ごとに同じ結びで終えるのは書式で、
 * 書き手の言い回しではない。endings は語彙表の結びの書き方。
 */
export const fixedEndingSpans = (text: string, endings: readonly string[]): Span[] => {
  const end = text.trimEnd().length;
  return endings.filter((ending) => ending !== "" && text.slice(0, end).endsWith(ending)).map((ending) => ({ start: end - ending.length, end }));
};

/** かぎ括弧の中（「国家公務員法等の一部を改正する法律」『…』）。引いた題や言葉で、書き手の言い回しではない。 */
const QUOTED = /「[^「」]*」|『[^『』]*』/gu;

export const quotedSpans = (text: string): Span[] => spansOf(text, QUOTED, () => true);

/**
 * 欄の名前（Cited by: footnote 2、External Links: Document）。大文字で始まる 1〜2 語にコロンが付き、後ろに値が続く。
 * 変換が残した書式や書類の欄で、項目ごとに繰り返す。Follow these guidelines: のような 3 語以上の導入は欄ではない。
 */
const FIELD_LABEL = /(?<![\p{L}\p{N}])\p{Lu}\p{L}*(?: \p{L}+)?:(?= \S)/gu;

export const fieldLabelSpans = (text: string, unit: LengthUnit): Span[] => (unit === "word" ? spansOf(text, FIELD_LABEL, () => true) : []);

/** 窓の中の空白でない文字の過半が飾りなら、その出現は飾り。 */
export const isFurniture = (text: string, mask: readonly boolean[], window: Span): boolean => {
  const visible = Array.from({ length: window.end - window.start }, (_, step) => window.start + step).filter((index) => !/\s/u.test(text[index] ?? ""));
  const marked = visible.filter((index) => mask[index] === true);
  return visible.length > 0 && marked.length * 2 > visible.length;
};
