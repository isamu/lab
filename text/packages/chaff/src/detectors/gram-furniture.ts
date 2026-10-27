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

/** 引いた題の後ろの結びとして読む長さ（を確認してください。は 10 文字）。これより長ければ、題の後ろに書き手の文が続いている。 */
const QUOTE_CLOSING_MAX = 12;
/**
 * 題を受ける格助詞（を、が、に、で、へ）一つと、述語だけ。助詞が無ければ引いた語が述語の一部（「実行」してまいります）で、
 * 二つ目の助詞があれば書き手が別のことを足している（「…支援」に力を尽くしてまいります）。
 */
const QUOTE_CLOSING = new RegExp(String.raw`[」』]([をがにでへ][^「」『』、，。．をがにでへ]{1,${String(QUOTE_CLOSING_MAX - 1)}}[。．]?)\s*$`, "u");

const closingAfterQuote = (text: string): Span | undefined => {
  const match = QUOTE_CLOSING.exec(text);
  return match === null ? undefined : { start: match.index + 1, end: match.index + match[0].length };
};

const closingTextOf = (text: string): string | undefined => {
  const span = closingAfterQuote(text);
  return span === undefined ? undefined : text.slice(span.start, span.end).trimEnd();
};

/**
 * 文書が参照の書式として使う結び: 引いた題の直後で結ぶことが、その結びで終わる文の過半である結び（詳しくは「…」を確認してください。）。
 * 引いた名前の後ろにたまたま来た書き手の結び（「生涯活躍のまち」を推進している。のほかは整備を推進している。）は、ほとんどが題の後ろではない。
 */
export const referenceClosings = (texts: readonly string[]): ReadonlySet<string> => {
  const afterQuote = texts.flatMap((text) => closingTextOf(text) ?? []);
  return new Set(
    [...new Set(afterQuote)].filter((closing) => {
      const quoted = afterQuote.filter((each) => each === closing).length;
      const ending = texts.filter((text) => text.trimEnd().endsWith(closing)).length;
      return quoted * 2 > ending;
    }),
  );
};

/**
 * 引いた題で終わる文の結び（詳しくは「入力可能な文字」を確認してください。）の範囲。手引きは別のページを指すたびに同じ結びで指す。
 * closings（referenceClosings）にある結びだけを、参照の書式として数えない。
 */
export const quotedClosingSpans = (text: string, closings: ReadonlySet<string>): Span[] => {
  const span = closingAfterQuote(text);
  const closing = closingTextOf(text);
  return span !== undefined && closing !== undefined && closings.has(closing) ? [span] : [];
};

/** 文書の中の番号の付いた部分を指す語（Section 3.1 の Section）。 */
const PART_LABELS = new Set([
  "section",
  "sections",
  "table",
  "tables",
  "figure",
  "figures",
  "fig.",
  "chapter",
  "chapters",
  "appendix",
  "appendices",
  "annex",
  "part",
  "parts",
]);

/** 語と、その後ろの番号（3.1、2b、B）。語が PART_LABELS にあれば文書の部分を指す名前。 */
const LABEL_AND_NUMBER = /\b([A-Z][a-z]+\.?)\s+(?:\d+(?:\.\d+)*[a-z]?|[A-Z])\b/gu;
/** 表2、図1-3、第3章、第2節。 */
const JA_PART_REFERENCE = /[表図][\d０-９]+(?:[-－.．][\d０-９]+)*|第[\d０-９一二三四五六七八九十]+[章節]/gu;

/**
 * 文書の部分を指す名前（Section 3.1、Table 2、Appendix B、表2、第3章）の範囲。名前と同じく、それにかかる語句
 * （the mechanism families set out in Section 3.1）は参照の書式で、数えない。
 */
export const partReferenceSpans = (text: string, unit: LengthUnit): Span[] =>
  unit === "word" ? spansOf(text, LABEL_AND_NUMBER, (match) => PART_LABELS.has((match[1] ?? "").toLowerCase())) : spansOf(text, JA_PART_REFERENCE, () => true);
