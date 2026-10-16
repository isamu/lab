import type { Span } from "chaffjs/plugin";

/**
 * 空行を挟まず 1 行に 1 項目を並べた箇条書き（「①誓約書」「・〜に関する業務」「(1)学歴：…」、`<br>` で改めた行）。
 * 項目は句点で終わらないので、分割器は項目の並び全体を 1 文に読む。行頭の印が、そこで文が改まる印。
 *
 * 切るのは、印で始まる行の前と後ろの改行。ただし前の行が読点で終わるか、括弧を開いたまま終わるなら、文は次の行へ続いている。
 * 印の無い行の折り返しは切らない。
 */

const SPACE = "[ \\t\\u3000]";
/** 記号の印。後ろに何が続いても項目の頭。「○」「◎」は議事録の発言者の印でもあるので含めない。 */
const BULLET = "[・•●■□◆◇▪▫★☆▶►➢✓]";
/** 番号の印。囲み数字（①〜㊿・⑴〜⒇）、括弧の番号・英字・仮名（(1)（イ））、数字と点・閉じ括弧（1. １．2)）。 */
const NUMBERED = [
  "[\\u2460-\\u2473\\u3251-\\u325F\\u32B1-\\u32BF\\u2474-\\u2487]",
  "[（(][0-9０-９]{1,3}[）)]",
  "[（(](?:[a-zA-Zａ-ｚＡ-Ｚ]|[ivx]{2,4}|[IVX]{2,4})[）)]",
  "[（(][\\p{Script=Katakana}\\p{Script=Hiragana}][）)]",
  "[0-9０-９]{1,3}[.．)）](?![0-9０-９])",
].join("|");
/**
 * 英字や片仮名 1 字の印は、空白で本文と区切るときだけ（「a. 教育機関」、片仮名 1 字と全角空白）。「イベント」は語。
 * 法令の号の漢数字は、全角空白で本文と区切るときだけ。半角空白なら「一 人で」のような本文。
 */
const SPACED = "(?:(?:[a-z][.)]|[ア-ンｱ-ﾝ])(?=[ \\t\\u3000])|[一二三四五六七八九十]{1,3}(?=\\u3000))";
/** 番号の後ろが助詞なら、番号は文の中の語（「①に掲げる」「(1)の規定」）。 */
const PARTICLE_AFTER = "(?![ \\t\\u3000]*(?:の|に|を|が|は|と|で|へ|も|から|まで|より|及び|又は|並びに|若しくは))";

const MARKER = new RegExp(`^${SPACE}*(?:${BULLET}|(?:${NUMBERED}|${SPACED})${PARTICLE_AFTER})`, "u");

/** 行が箇条書きの印で始まるか。 */
export const startsWithListMarker = (line: string): boolean => MARKER.test(line);

/** 行の終わりで、文が次の行へ続いている: 読点で終わるか、開いた括弧を閉じずに終わる。 */
const COMMA_END = /[、，,][ \t\u3000]*$/u;
const OPENERS = /[（(「『【［[｛{〔〈《]/gu;
const CLOSERS = /[）)」』】］\]｝}〕〉》]/gu;
const leavesBracketOpen = (line: string): boolean => (line.match(OPENERS)?.length ?? 0) > (line.match(CLOSERS)?.length ?? 0);
const continuesToNextLine = (line: string): boolean => COMMA_END.test(line) || leavesBracketOpen(line);

type Line = { readonly start: number; readonly end: number; readonly text: string };

const NEWLINE = /\r?\n/gu;

const linesOf = (text: string): Line[] => {
  const breaks = [...text.matchAll(NEWLINE)];
  const starts = [0, ...breaks.map((match) => match.index + match[0].length)];
  return starts.map((start, index) => {
    const end = breaks[index]?.index ?? text.length;
    return { start, end, text: text.slice(start, end) };
  });
};

/** 改行の前の行と後ろの行のどちらかが項目で、前の行が次へ続いていなければ、そこで文が改まる。 */
const isCut = (previous: Line, next: Line): boolean =>
  next.text.trim().length > 0 && !continuesToNextLine(previous.text) && (startsWithListMarker(next.text) || startsWithListMarker(previous.text));

/** 文を改める改行の位置: 前の行の終わり（end）と、次の行の最初の文字（start）。 */
export const listLineBreaks = (text: string): Span[] => {
  const lines = linesOf(text);
  return lines.slice(1).flatMap((next, index) => {
    const previous = lines[index];
    if (previous === undefined || !isCut(previous, next)) return [];
    return [{ start: previous.end, end: next.start + (next.text.length - next.text.trimStart().length) }];
  });
};

/**
 * 注記の印（「※」）。前の行に添える注記で、前の行の文を終えるとは限らない（「ファックス番号：…\n※送ったらご連絡ください。」）。
 * 文を改めはしないが、そこで文が始まっていれば項目と同じく段落を改める。
 */
const NOTE = /^[ \t\u3000]*※/u;

/** 箇条書きの項目か注記の行の頭: 行の始まりから印の最初の文字まで。項目を始める文は、ここで始まる。 */
export const listItemHeads = (text: string): Span[] =>
  linesOf(text).flatMap((line) =>
    startsWithListMarker(line.text) || NOTE.test(line.text)
      ? [{ start: line.start, end: line.start + line.text.length - line.text.trimStart().length + 1 }]
      : [],
  );

/** offset が、項目の頭（heads、並び順で重ならない）のどれかの中にあるか。 */
export const startsListItem = (lines: readonly Span[], offset: number): boolean => {
  const search = (low: number, high: number): Span | undefined => {
    if (low >= high) return lines[low - 1];
    const middle = (low + high) >> 1;
    return (lines[middle]?.start ?? Number.POSITIVE_INFINITY) > offset ? search(low, middle) : search(middle + 1, high);
  };
  const line = search(0, lines.length);
  return line !== undefined && offset < line.end;
};

/** span を、中にある改行（breaks）で割る。割った前の片は改行の手前で終わり、後ろの片は次の行の最初の文字から始まる。 */
export const cutAtBreaks = (span: Span, breaks: readonly Span[]): Span[] => {
  const inside = breaks.filter((part) => part.start > span.start && part.end < span.end);
  const starts = [span.start, ...inside.map((part) => part.end)];
  return starts.map((start, index) => ({ start, end: inside[index]?.start ?? span.end }));
};
