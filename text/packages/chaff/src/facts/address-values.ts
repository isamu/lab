import type { Span } from "../plugin.ts";

// Two kinds of value a docs site repeats from page to page, read by scanning rather than by a backtracking pattern:
// an email address (help@example.com) and a version of three parts or more, or one written with v (2.4.1, v3).

const LOCAL_CHAR = /[\p{L}\p{N}._%+-]/u;
const DOMAIN_CHAR = /[\p{L}\p{N}.-]/u;
const DOT = ".";

/** The longest address there is (RFC 5321), so a scan from one @ never reads the whole document. */
const MAX_ADDRESS = 254;

/** Where the run of isPart characters that ends at from begins (UTF-16 units, like the offsets). */
const extendLeft = (source: string, from: number, isPart: RegExp): number => {
  const windowStart = Math.max(0, from - MAX_ADDRESS);
  const stop = source
    .slice(windowStart, from)
    .split("")
    .findLastIndex((char) => !isPart.test(char));
  return windowStart + stop + 1;
};

/** Where the run of isPart characters that starts at from ends. */
const extendRight = (source: string, from: number, isPart: RegExp): number => {
  const stop = source
    .slice(from, from + MAX_ADDRESS)
    .split("")
    .findIndex((char) => !isPart.test(char));
  return stop === -1 ? Math.min(source.length, from + MAX_ADDRESS) : from + stop;
};

/** A sentence's full stop after an address or a version is not part of it. */
const withoutTrailingDots = (text: string): string => text.slice(0, text.split("").findLastIndex((char) => char !== DOT) + 1);

/** The address around one @: a local part, and the labels of the domain up to the first empty one, two or more. */
const addressAt = (source: string, at: number): Span | undefined => {
  const start = extendLeft(source, at, LOCAL_CHAR);
  const written = source.slice(at + 1, extendRight(source, at + 1, DOMAIN_CHAR)).split(DOT);
  const empty = written.indexOf("");
  const labels = empty === -1 ? written : written.slice(0, empty);
  if (start === at || labels.length < 2) return undefined;
  return { start, end: at + 1 + labels.join(DOT).length };
};

/** The addresses in the text, left to right. An @ inside the address before it starts none. */
export const emailSpans = (source: string): Span[] =>
  [...source.matchAll(/@/gu)].reduce<Span[]>((found, match) => {
    const span = addressAt(source, match.index);
    const previous = found.at(-1);
    return span === undefined || (previous !== undefined && span.start < previous.end) ? found : [...found, span];
  }, []);

/** A run of digits and dots, with a v before it or not, that starts a word. */
const VERSION_RUN = /(?<![\p{L}\p{N}.])v?\d[\d.]*/gu;
const WORD_CHAR = /[\p{L}\p{N}]/u;
const MIN_PARTS = 3;
const MAX_PARTS = 4;
const DIGITS = /^\d+$/u;

/** A version: v and one part or more (v3, v2.1), or three or four parts without it (2.4.1). Not a run that a word continues. */
const versionIn = (written: string, next: string): string | undefined => {
  const run = withoutTrailingDots(written);
  const prefixed = run.startsWith("v");
  const parts = (prefixed ? run.slice(1) : run).split(DOT);
  if (WORD_CHAR.test(next) && run === written) return undefined;
  if (!parts.every((part) => DIGITS.test(part))) return undefined;
  return prefixed || (parts.length >= MIN_PARTS && parts.length <= MAX_PARTS) ? run : undefined;
};

export const versionSpans = (source: string): Span[] =>
  [...source.matchAll(VERSION_RUN)].flatMap((match) => {
    const run = versionIn(match[0], source.charAt(match.index + match[0].length));
    return run === undefined ? [] : [{ start: match.index, end: match.index + run.length }];
  });
