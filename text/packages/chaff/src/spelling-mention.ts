import type { Span } from "./plugin.ts";

/** 丸括弧に入れた一つの語（（曇）、(くもり)）。中に句読点や空白、ほかの括弧があれば語と読まない。 */
const BRACKETED_WORD = /[（(][\p{L}\p{N}ー]{1,8}[）)]/gu;

/** 言い方の語句のすぐ前で、読点か中黒で並べた丸括弧の語の一続き（（くもり）、（曇））。 */
const BRACKETED_LIST = /(?:[（(][\p{L}\p{N}ー]{1,8}[）)][、，,・]?)+$/u;

/** phrase が text に出る位置。 */
const startsOf = (text: string, phrase: string): number[] =>
  phrase === ""
    ? []
    : text
        .split(phrase)
        .slice(0, -1)
        .reduce<number[]>((starts, part) => [...starts, (starts.length === 0 ? 0 : (starts.at(-1) ?? 0) + phrase.length) + part.length], []);

/** at の直前に並ぶ丸括弧の語の範囲。 */
const listBefore = (text: string, at: number): Span[] => {
  const list = BRACKETED_LIST.exec(text.slice(0, at));
  if (list === null) return [];
  return [...list[0].matchAll(BRACKETED_WORD)].map((match) => ({ start: list.index + match.index, end: list.index + match.index + match[0].length }));
};

/**
 * 別の書き方を言う文（（くもり）、（曇）とも書く。）の、言い方の語句（phrases: とも書く）のすぐ前に並ぶ、丸括弧に入れた語の範囲。
 * その語は書き方そのものを話題にしているので、本文の書き方とは比べない。言い方の語句が無ければ空。
 */
export const mentionedSpellingSpans = (text: string, phrases: readonly string[]): Span[] =>
  phrases.flatMap((phrase) => startsOf(text, phrase).flatMap((at) => listBefore(text, at)));
