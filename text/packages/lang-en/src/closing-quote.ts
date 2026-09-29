import type { Span } from "chaffjs/plugin";
import { NEXT_SENTENCE_HEAD } from "./quoted-stop.ts";

/**
 * sentence-splitter は疑問符・感嘆符の後の曲がった閉じ引用符（“Is it done?” Nobody …）と直線の一重引用符の手前で文を切る。
 * 次の文が「”」で始まり、前の文は引用符が開いたまま終わる。
 *
 * 前の文が句点で終わり、次の文がそこから間を置かずに閉じ引用符（閉じ括弧も）で始まるとき、それを前の文の末尾へ戻す。
 * 戻した後に空白と大文字が続けば文は二つのまま、何も続かなければ前の文だけ、
 * 小文字・数字・句読点が続けば引用は文の途中にあるので一つの文につなぐ（直線の二重引用符で分割器がそうするのと同じ）。
 * 開き引用符（“ ‘）は閉じの分類に入らない。語頭のアポストロフィ（’Tis ’90s）は後ろに字が続くので閉じと読まない。
 */
const CLOSING_RUN = /^[\p{Pf}\p{Pe}"']+/u;
const WORD_CHARACTER = /^[\p{L}\p{N}]/u;
const STOP_AT_END = /[.?!]$/u;
const NEXT_SENTENCE = new RegExp(`^${NEXT_SENTENCE_HEAD}`, "u");
const LEADING_SPACE = /^\s*/u;

/** 文頭の閉じ引用符の並びの長さ。後ろに字が続けば開き引用符かアポストロフィなので 0。 */
export const closingRunLength = (sentence: string): number => {
  const run = CLOSING_RUN.exec(sentence)?.[0].length ?? 0;
  return run > 0 && !WORD_CHARACTER.test(sentence.slice(run)) ? run : 0;
};

const follows = (text: string, previous: Span, span: Span): boolean =>
  previous.end === span.start && STOP_AT_END.test(text.slice(previous.start, previous.end));

/** previous と span を置き換える文。閉じ引用符が戻らなければ undefined。 */
const reattached = (text: string, previous: Span, span: Span): Span[] | undefined => {
  const run = follows(text, previous, span) ? closingRunLength(text.slice(span.start, span.end)) : 0;
  if (run === 0) return undefined;
  const quoteEnd = span.start + run;
  const rest = text.slice(quoteEnd, span.end);
  if (rest.trim() === "") return [{ start: previous.start, end: quoteEnd }];
  if (!NEXT_SENTENCE.test(rest)) return [{ start: previous.start, end: span.end }];
  const next = quoteEnd + (LEADING_SPACE.exec(rest)?.[0].length ?? 0);
  return [
    { start: previous.start, end: quoteEnd },
    { start: next, end: span.end },
  ];
};

/** 文の span の並び（text 上の位置）で、文頭に取り残された閉じ引用符を前の文へ戻したもの。 */
export const reattachClosingQuotes = (text: string, spans: readonly Span[]): Span[] =>
  spans.reduce<Span[]>((sentences, span) => {
    const previous = sentences.at(-1);
    const replaced = previous === undefined ? undefined : reattached(text, previous, span);
    if (replaced === undefined) sentences.push(span);
    else sentences.splice(-1, 1, ...replaced);
    return sentences;
  }, []);
