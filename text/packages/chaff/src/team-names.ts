import type { Span } from "./plugin.ts";

const SPACE = /\s/u;
const ESCAPE = /[.*+?^${}()|[\]\\]/gu;
const WHITESPACE_RUN = String.raw`\s+`;
const WRAP = String.raw`(?:\r?\n[ \t]*)?`;

/** 名前の中の空白は空白の並びに当て、字と字の間には折り返しの改行を許す。本文の行は好きな所で折れる。 */
const patternOf = (name: string): RegExp => {
  const pieces = Array.from(name.trim()).reduce<string[]>((acc, char) => {
    const previous = acc.at(-1);
    if (SPACE.test(char)) return previous === WHITESPACE_RUN ? acc : [...acc, WHITESPACE_RUN];
    const escaped = char.replace(ESCAPE, "\\$&");
    return previous === undefined || previous === WHITESPACE_RUN ? [...acc, escaped] : [...acc, WRAP, escaped];
  }, []);
  return new RegExp(pieces.join(""), "gu");
};

const occurrences = (text: string, name: string): Span[] =>
  name.trim().length === 0 ? [] : [...text.matchAll(patternOf(name))].map((match) => ({ start: match.index, end: match.index + match[0].length }));

const merged = (spans: readonly Span[]): Span[] =>
  spans
    .toSorted((left, right) => left.start - right.start)
    .reduce<Span[]>((acc, span) => {
      const last = acc.at(-1);
      if (last !== undefined && span.start < last.end) acc[acc.length - 1] = { start: last.start, end: Math.max(last.end, span.end) };
      else acc.push(span);
      return acc;
    }, []);

/**
 * チームが chaff.yaml の names に並べた名前が、text のどこにあるか。綴りは書かれたとおり（Apple と apple は別）。
 * 重なる出現は 1 つの範囲にまとめる。接するだけなら別の名前（並んだ 2 つの名前は 2 つと数える）。位置は text の先頭を 0 とする。
 */
export const nameSpans = (text: string, names: readonly string[]): Span[] => merged(names.flatMap((name) => occurrences(text, name)));

/** [start, end) が names の範囲のどれかと重なるか。 */
export const touchesAny = (spans: readonly Span[], start: number, end: number): boolean => spans.some((span) => start < span.end && span.start < end);
