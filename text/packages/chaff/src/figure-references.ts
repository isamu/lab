import { escapeRegExp } from "./orthography.ts";
import type { Span } from "./plugin.ts";

/**
 * 本文で番号を指した図・表・付録（図3、Table 2、Appendix B）と、それを行の頭に書いた所（キャプション、見出し）。
 * 行の頭に一度も書いていない番号を指していれば、参照先が無い。その種類（図、表）を行の頭に一つも書いていない文書は見ない。
 * 図が別の紙にある文書かもしれない。言語の知識（図や表の語、略した書き方、別の文書を指す語）は語彙表から受け取る。
 */
type LabelWord = {
  readonly word: string;
  /** 同じものを指す書き方をまとめる名前。「Fig.」は Figure。 */
  readonly kind: string;
};

export type LabelWords = {
  readonly labels: readonly LabelWord[];
  /** 番号のすぐ後ろにあると、別の文書の図になる語（of、in）。 */
  readonly elsewhere: readonly string[];
  /** 番号のすぐ後ろにあると、図の数になる語（図3枚）。 */
  readonly counters: readonly string[];
};

export type DanglingFigure = { readonly offset: number; readonly label: string };

type Mention = { readonly start: number; readonly end: number; readonly written: string; readonly key: string; readonly kind: string };

/** 語の前の字が漢字・カタカナ・英数字なら、長い語の一部（地図3、一覧表2、法別表第二、SubFigure）。 */
const INSIDE_WORD = "(?<![\\p{Script=Han}\\p{Script=Katakana}\\p{N}A-Za-z])";
/** 番号。数字（3、3.2、第3）、「第」の後の漢数字（別表第一）、大文字一つかローマ数字（Appendix B、Annex II）。 */
export const FIGURE_NUMBER = "[ \\t\\u00a0]?(?:第?(\\p{Nd}+(?:[.\\-－]\\p{Nd}+)*)|第([一二三四五六七八九十百]+)|([IVX]{2,5}|[A-ZＡ-Ｚ])(?![A-Za-z]))";

const forms = (word: string): string[] => [...new Set([word, word.toUpperCase()])];

const mentionPattern = (labels: readonly LabelWord[]): RegExp => {
  const words = labels
    .flatMap((label) => forms(label.word))
    .toSorted((a, b) => b.length - a.length)
    .map(escapeRegExp);
  return new RegExp(`${INSIDE_WORD}(${words.join("|")})${FIGURE_NUMBER}`, "gu");
};

const kindOf = (written: string, labels: readonly LabelWord[]): string => labels.find((label) => forms(label.word).includes(written))?.kind ?? written;

/** 同じ図は同じ鍵。全角の数字と字は半角に揃える。 */
const mentionsIn = (text: string, labels: readonly LabelWord[]): Mention[] =>
  [...text.matchAll(mentionPattern(labels))].map((match) => {
    const kind = kindOf(match[1] ?? "", labels);
    const number = (match[2] ?? match[3] ?? match[4] ?? "").normalize("NFKC");
    return { start: match.index, end: match.index + match[0].length, written: match[0].trim(), key: `${kind}\u0000${number}`, kind };
  });

type Scan = { readonly depth: number; readonly kept: string; readonly previous: string };

/** 開きの括弧。「(」はリンクの行き先（[...](...)）のときだけ、つまり「]」のすぐ後ろだけ。 */
const opens = (char: string, previous: string): boolean => char === "[" || char === "<" || (char === "(" && previous === "]");
const CLOSERS = "])>";

const step = (state: Scan, char: string): Scan => {
  if (opens(char, state.previous)) return { depth: state.depth + 1, kept: state.kept, previous: char };
  if (state.depth > 0 && CLOSERS.includes(char)) return { depth: state.depth - 1, kept: state.kept, previous: char };
  return { depth: state.depth, kept: state.depth === 0 ? state.kept + char : state.kept, previous: char };
};

/** 括弧の外の字。リンクと画像の書き方（[...](...)）と HTML の札（<b>）の中身は、行の頭の飾りとして読み飛ばす。 */
const outsideMarkup = (text: string): string => [...text].reduce(step, { depth: 0, kept: "", previous: "" }).kept;
const LETTER = /\p{L}/u;

const HEADING = /^[ \t]{0,3}#/u;

/**
 * 番号の後ろが題の区切りか。行の終わり、区切りの記号（: . — | 括弧）、または空白のあとの題の書き出し。
 * 空白のあとがひらがなか英語の小文字なら、本文の文（図3の例では、Figure 3 shows）で、キャプションではない。
 */
const CAPTION_AFTER = /^(?:[ \t]*$|[:：.．—–\-|()（）【】\]*_]|[ \t\u3000]+[^\p{Script=Hiragana}\p{Ll}])/u;

/**
 * 行の頭に書いた番号。前にあるのが飾り（#、**、![、|、【、箇条書きの印）だけで、見出しの中か、後ろが題の区切りならキャプション。
 * 行の頭から始まる本文の文（図３の例では、…）は、図の置き場所ではない。
 */
const isLabelled = (source: string, mention: Mention): boolean => {
  const lineStart = source.lastIndexOf("\n", mention.start - 1) + 1;
  const lineEnd = source.indexOf("\n", mention.end);
  const before = source.slice(lineStart, mention.start);
  if (LETTER.test(outsideMarkup(before))) return false;
  return HEADING.test(before) || CAPTION_AFTER.test(source.slice(mention.end, lineEnd === -1 ? source.length : lineEnd));
};

const LATIN_WORD = /^[A-Za-z]/u;

/** 番号のすぐ後ろの語。別の文書の図（Figure 5 of the report）か、図の数（図3枚）なら参照として見ない。 */
const pointsHere = (text: string, mention: Mention, words: LabelWords): boolean => {
  const after = text.slice(mention.end);
  const trimmed = after.trimStart();
  const elsewhere = words.elsewhere.some((word) => after !== trimmed && trimmed.startsWith(word) && !LATIN_WORD.test(trimmed.slice(word.length)));
  return !elsewhere && !words.counters.some((word) => after.startsWith(word));
};

/** 行の頭に書いた番号（キャプションや見出し）。図の置き場所。 */
const labelledIn = (source: string, labels: readonly LabelWord[]): Mention[] => mentionsIn(source, labels).filter((mention) => isLabelled(source, mention));

/** 文書が行の頭に番号を書いている種類（図、Table）。番号で名指しできる種類。 */
export const labelledKindsIn = (source: string, words: LabelWords): ReadonlySet<string> =>
  new Set(labelledIn(source, words.labels).map((mention) => mention.kind));

/**
 * 参照先の無い番号。source は行の頭を読み、prose（コードを覆った本文）は参照を読む。位置は同じ。
 * 番号は、キャプションが 1 と書けば 1a や 1(b) の参照も 1 に当たる（番号の後ろの字は読まない）。
 * リンクの字（[Figure 2](figures.md)）は、そのリンクが行き先を持つので参照として見ない。
 */
export const danglingFigures = (source: string, prose: string, words: LabelWords, links: readonly Span[] = []): DanglingFigure[] => {
  if (words.labels.length === 0) return [];
  const labelled = labelledIn(source, words.labels);
  const labelledKeys = new Set(labelled.map((mention) => mention.key));
  const labelledKinds = new Set(labelled.map((mention) => mention.kind));
  return mentionsIn(prose, words.labels)
    .filter((mention) => labelledKinds.has(mention.kind) && !labelledKeys.has(mention.key))
    .filter((mention) => pointsHere(prose, mention, words) && !links.some((link) => link.start <= mention.start && mention.end <= link.end))
    .map((mention) => ({ offset: mention.start, label: mention.written }));
};
