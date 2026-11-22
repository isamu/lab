import type { Span } from "./plugin.ts";

/**
 * 紹介記事の一覧で、リンクを外して写した行の頭の題名（〜の取り組みについて（デジタル庁公式note） 〜を紹介しています。）。
 * 題名は行の頭から、載せた媒体の名前を入れた全角の丸括弧まで。その後ろに半角の空白を一つ置いて、紹介の文が続く。
 * 題名は行き先のページのもので、書き手は言い換えられない。括弧の中に「の」のほかのひらがなのある説明（写しが原本と同じことの認証）、
 * 後ろが助詞で続く文の中の名前（〜（IPA） をご覧ください）、後ろが空白や記号の表（（自己株式等） －－－）は題名と見ない。
 */

const LINE_BREAKS = /[\n\r\u2028\u2029]/gu;
const INDENT = /[ \t]/u;
const BULLET_MARK = /[-*+]/u;
const DIGIT = /\d/u;
const NUMBER_CLOSE = /[.)]/u;
const MAX_NUMBER_DIGITS = 3;
/** 題名の字: 行の終わり、文の終わり、表の線のほか。 */
const TITLE_CHAR = /[^\n。|]/u;
const OPEN = "（";
const CLOSE = "）";
/** 媒体の名前の字: 閉じ括弧・改行と、「の」のほかのひらがなは入らない。 */
const NAME_STOP = /[）\n\p{Script=Hiragana}]/u;
const NAME_PARTICLE = "の";
const MAX_NAME_LENGTH = 30;
const BLURB_OPEN = "「";
/** 紹介の文の頭に来ない字: 空白、句読点・記号、文の中の名前に続く助詞。 */
const NOT_BLURB_HEAD = /[\s\p{P}\p{S}をがにへでとはもの]/u;

/** from から pattern の字が続く長さ（limit まで）。 */
const runLength = (text: string, from: number, pattern: RegExp, limit = Number.POSITIVE_INFINITY): number => {
  const rest = text.slice(from, Math.min(text.length, from + limit));
  const stop = rest.split("").findIndex((char) => !pattern.test(char));
  return stop === -1 ? rest.length : stop;
};

/** 長いほうから並べた from+length … from+1。 */
const longestFirst = (from: number, length: number): number[] => Array.from({ length }, (_, index) => from + length - index);

/** 箇条書きの印（- 、1. ）とその後ろの空白の終わりの候補。正規表現が試す順（数字も空白も長いほうから）。 */
const bulletEnds = (text: string, at: number): number[] => {
  const markEnds = BULLET_MARK.test(text.charAt(at))
    ? [at + 1]
    : longestFirst(at, runLength(text, at, DIGIT, MAX_NUMBER_DIGITS))
        .filter((digitsEnd) => NUMBER_CLOSE.test(text.charAt(digitsEnd)))
        .map((digitsEnd) => digitsEnd + 1);
  return markEnds.flatMap((markEnd) => longestFirst(markEnd, runLength(text, markEnd, INDENT)));
};

/** 行の頭から題名が始まりうる位置。字下げを長いほうから、それぞれ印のある読み方を先に。 */
const titleStarts = (text: string, lineStart: number): number[] => {
  const indents = [...longestFirst(lineStart, runLength(text, lineStart, INDENT)), lineStart];
  return [...new Set(indents.flatMap((at) => [...bulletEnds(text, at), at]))];
};

/** open の開き括弧から、媒体の名前を入れて閉じた括弧の後ろの位置。名前でなければ undefined。 */
const nameBracketEnd = (text: string, open: number): number | undefined => {
  const chars = [...text.slice(open + OPEN.length, open + OPEN.length + 2 * (MAX_NAME_LENGTH + 1))];
  const length = chars.findIndex((char) => char !== NAME_PARTICLE && NAME_STOP.test(char));
  if (length < 1 || length > MAX_NAME_LENGTH || chars[length] !== CLOSE) return undefined;
  return open + OPEN.length + chars.slice(0, length).join("").length + CLOSE.length;
};

/** at から半角の空白一つと、紹介の文の頭の字が続くか。 */
const startsBlurb = (text: string, at: number): boolean => {
  const head = text.codePointAt(at + 1);
  if (text.charAt(at) !== " " || head === undefined) return false;
  const char = String.fromCodePoint(head);
  return char === BLURB_OPEN || !NOT_BLURB_HEAD.test(char);
};

/** start から始まる題名。題名の字は一字以上で、題名に入らない字の手前の開き括弧までを試す。 */
const titleFrom = (text: string, start: number): Span | undefined => {
  const stop = start + runLength(text, start, TITLE_CHAR);
  const opens = longestFirst(start, stop - start)
    .toReversed()
    .filter((open) => text.charAt(open) === OPEN);
  return opens
    .map((open) => ({ start, end: nameBracketEnd(text, open) }))
    .find((title): title is Span => title.end !== undefined && startsBlurb(text, title.end));
};

const lineStarts = (text: string): number[] => [0, ...Array.from(text.matchAll(LINE_BREAKS), (match) => match.index + 1)];

/** 行の頭の、媒体の名前を括弧に入れた題名の範囲（行頭の箇条書きの印は含まない）。位置は source の上。 */
export const runInTitleSpans = (source: string): Span[] =>
  lineStarts(source).reduce<Span[]>((titles, lineStart) => {
    if (lineStart < (titles.at(-1)?.end ?? 0)) return titles;
    const title = titleStarts(source, lineStart)
      .map((start) => titleFrom(source, start))
      .find((found) => found !== undefined);
    return title === undefined ? titles : [...titles, title];
  }, []);
