import { escapeRegExp } from "./orthography.ts";
import { lowerBound } from "./detectors/token-column.ts";
import type { DocumentNamer, Span } from "./plugin.ts";

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

export type Mention = { readonly start: number; readonly end: number; readonly written: string; readonly key: string; readonly kind: string };

/** 語の前の字が漢字・カタカナ・英数字なら、長い語の一部（地図3、一覧表2、法別表第二、SubFigure）。 */
const INSIDE_WORD = "(?<![\\p{Script=Han}\\p{Script=Katakana}\\p{N}A-Za-z])";
/** 番号。数字（3、3.2、第3）、「第」の後の漢数字（別表第一）、大文字一つかローマ数字（Appendix B、Annex II）。 */
export const FIGURE_NUMBER = "[ \\t\\u00a0]?(?:第?(\\p{Nd}+(?:[.\\-－]\\p{Nd}+)*)|第([一二三四五六七八九十百]+)|([IVX]{2,5}|[A-ZＡ-Ｚ])(?![A-Za-z]))";

const forms = (word: string): string[] => [...new Set([word, word.toUpperCase()])];

const labelAlternation = (labels: readonly LabelWord[]): string =>
  labels
    .flatMap((label) => forms(label.word))
    .toSorted((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");

const mentionPattern = (labels: readonly LabelWord[]): RegExp => new RegExp(`${INSIDE_WORD}(${labelAlternation(labels)})${FIGURE_NUMBER}`, "gu");

/** 番号の付いた図か、番号の無い図（「…の別表に」）。番号が無ければ後ろが長い語の続きでない（表示、別表第一の「第」は番号）。 */
const labelPattern = (labels: readonly LabelWord[]): RegExp =>
  new RegExp(`${INSIDE_WORD}(${labelAlternation(labels)})(?:${FIGURE_NUMBER}|(?![\\p{Script=Han}\\p{Script=Katakana}A-Za-z]))`, "gu");

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

/** 文書の名前を読む言語の知識と、その名前が届く範囲（文）。 */
export type Citations = { readonly namedDocument: DocumentNamer; readonly sentences: readonly Span[] };

type NamedLabel = { readonly start: number; readonly kind: string; readonly self: boolean };

/** 文書の名前のすぐ後ろに書いた図の語（「…(平成二十年厚生労働省告示第五十九号)別表第一」「…号)の別表」「この規則の別表第三」）。 */
const namedLabelsIn = (prose: string, labels: readonly LabelWord[], namedDocument: DocumentNamer): NamedLabel[] =>
  [...prose.matchAll(labelPattern(labels))].flatMap((match) => {
    const named = namedDocument(prose, match.index);
    return named === undefined ? [] : [{ start: match.index, kind: kindOf(match[1] ?? "", labels), self: named.self }];
  });

/** offset を含む文の頭。文の外（見出し）なら offset。文は文書の順に並んでいる。 */
const sentenceStartAt = (sentences: readonly Span[], starts: readonly number[], offset: number): number => {
  const sentence = sentences[lowerBound(starts, offset + 1) - 1];
  return sentence !== undefined && offset < sentence.end ? sentence.start : offset;
};

/**
 * 他の文書の図か。同じ文の中で、その番号の位置までに名前を添えて書いた同じ種類の図のうち、いちばん近いものが他の文書のもの。
 * 「(…告示第五十九号)別表第一…及び別表第二」「…別表第一から別表第三まで」の後ろの番号も、その告示の別表。
 * 「…手数料規則の別表第二により、この規則の別表第三による」の別表第三は、この文書のものと名指している。
 * 文と名前の位置は二分探索で引く。参照先の無い番号が何万あっても、文書の長さの二乗にしない。
 */
const citedElsewhere = (named: readonly NamedLabel[], sentences: readonly Span[]): ((mention: Mention) => boolean) => {
  const starts = sentences.map((sentence) => sentence.start);
  const byKind = new Map(
    [...new Set(named.map((label) => label.kind))].map((kind) => {
      const labels = named.filter((label) => label.kind === kind);
      return [kind, { labels, starts: labels.map((label) => label.start) }];
    }),
  );
  return (mention) => {
    const ofKind = byKind.get(mention.kind);
    const nearest = ofKind?.labels[lowerBound(ofKind.starts, mention.start + 1) - 1];
    return nearest !== undefined && !nearest.self && nearest.start >= sentenceStartAt(sentences, starts, mention.start);
  };
};

/**
 * 参照先の無い番号。source は行の頭を読み、prose（コードを覆った本文）は参照を読む。位置は同じ。
 * 番号は、キャプションが 1 と書けば 1a や 1(b) の参照も 1 に当たる（番号の後ろの字は読まない）。
 * リンクの字（[Figure 2](figures.md)）は、そのリンクが行き先を持つので参照として見ない。
 */
export const danglingFigures = (
  source: string,
  prose: string,
  words: LabelWords,
  links: readonly Span[] = [],
  citations: Citations | undefined = undefined,
): DanglingFigure[] => {
  if (words.labels.length === 0) return [];
  const labelled = labelledIn(source, words.labels);
  const labelledKeys = new Set(labelled.map((mention) => mention.key));
  const labelledKinds = new Set(labelled.map((mention) => mention.kind));
  const dangling = mentionsIn(prose, words.labels)
    .filter((mention) => labelledKinds.has(mention.kind) && !labelledKeys.has(mention.key))
    .filter((mention) => pointsHere(prose, mention, words) && !links.some((link) => link.start <= mention.start && mention.end <= link.end));
  // 他の文書の名前は、参照先の無い番号があるときだけ読む。図の語のたびに名前を後ろ向きに読む代金を、ふつうの文書に払わせない。
  const named = dangling.length === 0 || citations === undefined ? [] : namedLabelsIn(prose, words.labels, citations.namedDocument);
  const elsewhere = named.length === 0 || citations === undefined ? () => false : citedElsewhere(named, citations.sentences);
  return dangling.filter((mention) => !elsewhere(mention)).map((mention) => ({ offset: mention.start, label: mention.written }));
};

/**
 * The document's captions (a number at the start of a line) and its references in the text (every other mention that
 * points at this document, outside a link), each in document order. Only the kinds the document labels somewhere.
 */
export const figureMentions = (
  source: string,
  prose: string,
  words: LabelWords,
  links: readonly Span[] = [],
): { readonly captions: readonly Mention[]; readonly references: readonly Mention[] } => {
  if (words.labels.length === 0) return { captions: [], references: [] };
  const captions = labelledIn(source, words.labels);
  const kinds = new Set(captions.map((mention) => mention.kind));
  const references = mentionsIn(prose, words.labels)
    .filter((mention) => kinds.has(mention.kind) && !isLabelled(source, mention))
    .filter((mention) => pointsHere(prose, mention, words) && !links.some((link) => link.start <= mention.start && mention.end <= link.end));
  return { captions, references };
};
