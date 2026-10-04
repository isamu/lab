import type { Detector, Finding } from "../plugin.ts";
import { quoteAround } from "./quote-around.ts";

// A word English always capitalises (a weekday, a month) written in lower case ("on monday"). The words come from the rule's
// lexicon "calendar-name"; the pattern is the capitalised form.

export type LowercaseName = { readonly offset: number; readonly written: string; readonly usual: string };

/** Characters that make the word part of a name in code, a path, an address or a tag (monday.md, /july/, @friday, #june). */
const NOT_PROSE_BESIDE = /[\p{L}\p{N}_/.@#:=-]/u;

/** A period or colon ends the sentence or clause unless a name continues after it (monday.md, june:2). */
const SENTENCE_STOP = /[.:]/u;
const WORD_CHAR = /[\p{L}\p{N}_]/u;

const joinsAfter = (text: string, end: number): boolean =>
  SENTENCE_STOP.test(text.charAt(end)) ? WORD_CHAR.test(text.charAt(end + 1)) : NOT_PROSE_BESIDE.test(text.charAt(end));

/** A value after a key or a field marker (day: monday, day = monday, "day": "monday", * * monday) is data, not prose. */
const VALUE_MARK = /[:=*]/u;
const STRAIGHT_QUOTE = /["']/u;
const SPACE_OR_QUOTE = /[\s"']/u;
/** How far back to look past spaces and quotes for the key's mark. */
const VALUE_REACH = 8;

const markBefore = (text: string, start: number): string =>
  Array.from(text.slice(Math.max(0, start - VALUE_REACH), start))
    .reverse()
    .find((char) => !SPACE_OR_QUOTE.test(char)) ?? "";

const isValue = (text: string, start: number): boolean => STRAIGHT_QUOTE.test(text.charAt(start - 1)) || VALUE_MARK.test(markBefore(text, start));

const capitalOf = (word: string): string => `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

export const lowercaseNamesIn = (text: string, names: readonly string[]): LowercaseName[] => {
  const lower = new Map(names.map((name) => [name.toLowerCase(), capitalOf(name)]));
  return [...text.matchAll(/\p{Ll}+/gu)].flatMap((match) => {
    const usual = lower.get(match[0]);
    const end = match.index + match[0].length;
    if (usual === undefined || NOT_PROSE_BESIDE.test(text.charAt(match.index - 1)) || isValue(text, match.index) || joinsAfter(text, end)) return [];
    return [{ offset: match.index, written: match[0], usual }];
  });
};

export const lowercaseName: Detector = (doc): Finding[] => {
  const text = doc.prose ?? doc.source;
  return lowercaseNamesIn(
    text,
    (doc.lexicons["calendar-name"] ?? []).map((entry) => entry.pattern),
  ).map((name) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, name.offset, name.offset + name.written.length),
    values: { written: name.written, usual: name.usual, offset: name.offset },
  }));
};
