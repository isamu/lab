import type { Span } from "chaffjs/plugin";
import { escapeRegExp } from "./regexp.ts";

/**
 * 空行を挟まず 1 行に 1 項目を並べた箇条書き（「①誓約書」「・〜に関する業務」「(1)学歴：…」、`<br>` で改めた行）。
 * 項目は句点で終わらないので、分割器は項目の並び全体を 1 文に読む。行頭の印が、そこで文が改まる印。
 *
 * 切るのは、印で始まる行の前と後ろの改行。ただし前の行が読点で終わるか、括弧を開いたまま終わるなら、文は次の行へ続いている。
 * 印の無い行の折り返しは切らない。
 *
 * 番号だけの札の行（「第１」「第３条」）と、行頭の括弧で囲んだ札（「（別添）…」）も、印で始まる行と同じに切る。札の語は辞書から取る。
 * URL だけの行、欄の行（電話：…、〒…）、括弧の語だけの行も、文の途中に立っていなければ前後で切る（メールマガジンや連絡先の欄）。
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

/**
 * 注記の印（「※」）。前の行に添える注記で、前の行の文を終えるとは限らない（「ファックス番号：…\n※送ったらご連絡ください。」）。
 * 注記は折り返して次の行へ続くこともあるので、注記の行の前と後ろでは文を改めない。ただし注記の行が並べば、その間で改める。
 * そこで文が始まっていれば項目と同じく段落を改める。
 */
const NOTE = /^[ \t\u3000]*※/u;

/**
 * 印のほかに、行を項目と同じに切る札。
 * label は番号だけの行（「第１」「第３条」「第二章の二」）。数える語は辞書 numbering-counter から。
 * tag は行頭の括弧で囲んだ札（「（別添）」「【参考】」）。札の語は辞書 line-head-tag から。後ろが助詞なら文の中の語（「（別添）の資料」）。
 */
export type LineVocabulary = { readonly label: RegExp; readonly tag: RegExp | undefined };

const NUMERAL = "[0-9０-９〇一二三四五六七八九十百千]+";
const TAG_OPENER = "[（(【〔［]";
const TAG_CLOSER = "[）)】〕］]";
const alternativesOf = (words: readonly string[]): string => words.map(escapeRegExp).join("|");

/** counters は番号を数える語（条、章）、tags は括弧で囲む札の語（別添、参考）。 */
export const lineVocabulary = (counters: readonly string[], tags: readonly string[]): LineVocabulary => {
  const counter = counters.length === 0 ? "" : `(?:${alternativesOf(counters)})?`;
  return {
    label: new RegExp(`^${SPACE}*第${NUMERAL}${counter}(?:の${NUMERAL})*${SPACE}*$`, "u"),
    tag: tags.length === 0 ? undefined : new RegExp(`^${SPACE}*${TAG_OPENER}(?:${alternativesOf(tags)})${TAG_CLOSER}${PARTICLE_AFTER}`, "u"),
  };
};

/** 項目の行: 箇条書きの印、番号だけの札、行頭の括弧の札で始まる。その前でも後ろでも文が改まる。 */
const isListLine = (line: string, vocabulary: LineVocabulary): boolean =>
  startsWithListMarker(line) || vocabulary.label.test(line) || (vocabulary.tag?.test(line) ?? false);

/** URL だけの行（▼こちら の次の行のアドレス）。 */
const URL_LINE = new RegExp(`^${SPACE}*https?://\\S+${SPACE}*$`, "u");
/**
 * 欄の行: 短い札と全角か半角のコロンで始まる行（電話：03-…、E-mail：…）と、郵便番号の印〒で始まる行。連絡先の欄は 1 行 1 項目。
 * 札が数字で終われば時刻（10:00、午前10:00）か比（1:2）で、札ではない。
 */
const FIELD_LINE = new RegExp(`^${SPACE}*(?:〒|[^\\s、。，：:「」『』（）()【】]{0,11}[^\\s、。，：:「」『』（）()【】0-9０-９][：:])`, "u");
/** 括弧でくくった語だけの行（（お問い合わせ先）、【新着】（文部科学省）、「報告書は実践の宝庫」）。札か題で、文の途中ではない。 */
const BRACKET_GROUP = "[（(【〔［「『][^（(【〔［「『）)】〕］」』\\n]*[）)】〕］」』]";
const BRACKET_LINE = new RegExp(`^(?:${SPACE}*${BRACKET_GROUP})+${SPACE}*$`, "u");
/** 空白の後の括弧の注記で終わる行（題 （○○小学校））。題の行の終わりで、文は折り返しても括弧の前に空白を置かない。 */
const NOTE_IN_BRACKETS_END = new RegExp(`\\S${SPACE}+[（(][^（(）)\\n]*[）)]${SPACE}*$`, "u");

/** 行が助詞で始まる: 前の行の語を受けて文が続いている（「…」\nと述べた）。 */
const PARTICLE_START = new RegExp(`^${SPACE}*(?:の|に|を|が|は|と|で|へ|も|から|まで|より|及び|又は|並びに|若しくは)`, "u");
/** 行が助詞で終わる: 文が次の行へ続いている（担当者は\n「…」）。 */
const PARTICLE_END = new RegExp(`(?:の|に|を|が|は|と|で|へ|も|から|まで|より)${SPACE}*$`, "u");

/** 1 行で一つの単位になりうる行: URL、欄、括弧の語だけ。 */
const standsAlone = (line: string): boolean => URL_LINE.test(line) || FIELD_LINE.test(line) || BRACKET_LINE.test(line);

/** 空白だけの行。段落の中では、伏せた URL やコードが 1 行を占めていた所。 */
const isMaskedLine = (line: string): boolean => line.trim() === "";

/**
 * 行が文の途中に立っていない: 前の行が読点・開いた括弧・助詞で終わらず、次の行が助詞で始まらない。
 * 折り返した文の途中に括弧の語だけの行が来ることがある（〜始まり、\n（休憩を挟んで）\n夕方まで続く。）。
 */
const standsBetween = (before: Line | undefined, after: Line | undefined): boolean =>
  (before === undefined || (!continuesToNextLine(before.text) && !PARTICLE_END.test(before.text))) && (after === undefined || !PARTICLE_START.test(after.text));

/** 1 行で一つの単位の行。その前でも後ろでも文が改まる。 */
const isUnitLine = (lines: readonly Line[], index: number): boolean =>
  standsAlone(lines[index]?.text ?? "") && standsBetween(lines[index - 1], lines[index + 1]);

/**
 * index の行の後ろで文が改まる: 1 行で一つの単位の行、題の注記で終わる行、伏せた行の後ろ。
 * 次の行が注記（※）なら、その行に添える注記なので続ける。
 */
const endsUnitAt = (lines: readonly Line[], index: number): boolean => {
  const line = lines[index]?.text ?? "";
  const ends = isUnitLine(lines, index) || ((NOTE_IN_BRACKETS_END.test(line) || isMaskedLine(line)) && standsBetween(lines[index - 1], lines[index + 1]));
  return ends && !NOTE.test(lines[index + 1]?.text ?? "");
};

/**
 * index - 1 の行と index の行の間で文が改まるか: どちらかが項目の行か、1 行で一つの単位の行か、注記の行が続く。
 * 前の行が次へ続いている（読点、開いた括弧）なら改まらない。
 */
const isCut = (lines: readonly Line[], index: number, vocabulary: LineVocabulary): boolean => {
  const previous = lines[index - 1]?.text ?? "";
  const next = lines[index]?.text ?? "";
  return (
    next.trim().length > 0 &&
    !continuesToNextLine(previous) &&
    (isListLine(next, vocabulary) ||
      isListLine(previous, vocabulary) ||
      isUnitLine(lines, index) ||
      endsUnitAt(lines, index - 1) ||
      (NOTE.test(previous) && NOTE.test(next)))
  );
};

/** 文を改める改行の位置: 前の行の終わり（end）と、次の行の最初の文字（start）。 */
export const listLineBreaks = (text: string, vocabulary: LineVocabulary): Span[] => {
  const lines = linesOf(text);
  return lines.slice(1).flatMap((next, offset) => {
    const previous = lines[offset];
    if (previous === undefined || !isCut(lines, offset + 1, vocabulary)) return [];
    return [{ start: previous.end, end: next.start + (next.text.length - next.text.trimStart().length) }];
  });
};

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
