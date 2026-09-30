// lang-en/src/quoted-stop.ts の写し。アダプタは互いに依存しないので、和文の中の英文に同じ手当てをするために置く。元とのずれは test_mixed_language_stops.ts で比べる。
import type { Span } from "chaffjs/plugin";
import { isAbbreviation } from "./sentence-split.ts";

/**
 * 米国式の引用は、文末のピリオドを閉じ引用符の内側に置く（…called it "a fair trial." Plainly, …）。
 * sentence-splitter は引用符の中の句点で文を切らず、引用符が閉じた後の空白でも切らないので、次の文が前の文につながる。
 *
 * 分割器が返した一つの文を、文末の記号 + 閉じ引用符 + 空白 + 次の文の頭（大文字。開き括弧・引用符の後の大文字も）で切る。
 * 引用符の中の語が略語・頭文字（"U.S." "Dr." "J."）のときと、括弧が開いたままのときは切らない。
 */
/** 次の文の頭。空白の後の大文字。開き括弧・引用符の後の大文字も文頭である。 */
export const NEXT_SENTENCE_HEAD = String.raw`\s+[\p{Ps}\p{Pi}"']*\p{Lu}`;
const QUOTED_STOP = new RegExp(String.raw`[.?!]["'”’]+(?=${NEXT_SENTENCE_HEAD})`, "gu");
// ピリオドの前の語は、空白・開き引用符・開き括弧の後から数える。
const WORD_START = /[\s\p{Ps}\p{Pi}"']/u;
// 一字ずつピリオドを打った語（J. / U.S. / e.g.）は、略語の一覧に無くても略語。
const INITIALS = /^(?:\p{L}\.)+$/u;
// 分割器が一組として読む括弧（( [ { （ ［ ｛ 【 《 「 『 …）は、Unicode の開き・閉じ括弧の分類にすべて入る。
const OPENER = /\p{Ps}/u;
const CLOSER = /\p{Pe}/u;

const endsWithAbbreviation = (sentence: string, stop: number): boolean => {
  if (sentence[stop] !== ".") return false;
  const word = `${sentence.slice(0, stop).split(WORD_START).at(-1) ?? ""}.`;
  return isAbbreviation(word) || INITIALS.test(word);
};

// 対の無い閉じ括弧（「1) 最初の項目」の番号）は、後から開く括弧を打ち消さない。
const depthAfter = (depth: number, char: string): number => {
  if (OPENER.test(char)) return depth + 1;
  return CLOSER.test(char) ? Math.max(0, depth - 1) : depth;
};

const bracketOpenAt = (sentence: string, index: number): boolean => Array.from(sentence.slice(0, index)).reduce(depthAfter, 0) > 0;

type Cut = { readonly end: number; readonly next: number };

const cutsIn = (sentence: string): Cut[] =>
  [...sentence.matchAll(QUOTED_STOP)]
    .filter((match) => !endsWithAbbreviation(sentence, match.index) && !bracketOpenAt(sentence, match.index))
    .map((match) => {
      const end = match.index + match[0].length;
      return { end, next: end + (/^\s+/u.exec(sentence.slice(end))?.[0].length ?? 0) };
    });

/** span の文を、閉じ引用符の内側で閉じた文ごとに分けた span。切れ目が無ければ span そのもの一つ。 */
export const splitAtQuotedStops = (text: string, span: Span): Span[] => {
  const cuts = cutsIn(text.slice(span.start, span.end));
  const starts = [0, ...cuts.map((cut) => cut.next)];
  const ends = [...cuts.map((cut) => cut.end), span.end - span.start];
  return starts.map((start, index) => ({ start: span.start + start, end: span.start + (ends[index] ?? start) }));
};
