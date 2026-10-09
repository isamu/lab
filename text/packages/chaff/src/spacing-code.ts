import type { Span } from "./plugin.ts";

// Text beside which a space is not a spacing choice: a clock time (13:30), which like 3時 names a time rather than a
// quantity, and an e-mail address or a URL, whose end a reader and an auto-linker find by the space after it. Pure.

/** A clock time: hours, a colon, minutes, and seconds optionally (9:05, 13:30, 08:00:15). */
const CLOCK_TIME = /(?<![\d:：.])\d{1,2}[:：][0-5]\d(?:[:：][0-5]\d)?(?![\d:：])/gu;

/** A run of printable ASCII without brackets: an address ends where Japanese text, a space or a bracket starts (…/faq で). */
const ASCII_RUN = /[!-'*-~]+/gu;

/** An e-mail address (a local part, @, and a domain with a dot) or a URL with its scheme or www. */
const EMAIL = /^[\w.+-]+@[\w-]+\.[\w.-]+$/u;
const URL_START = /^(?:https?:\/\/|www\.)/u;

const isAddress = (word: string): boolean => EMAIL.test(word) || URL_START.test(word);

const spansOf = (text: string, pattern: RegExp): Span[] =>
  [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

export const clockTimeSpans = (text: string): Span[] => spansOf(text, CLOCK_TIME);

export const addressSpans = (text: string): Span[] => spansOf(text, ASCII_RUN).filter((span) => isAddress(text.slice(span.start, span.end)));

/** Whether the character at `at` is inside one of the spans. */
export const isInsideSpan = (spans: readonly Span[], at: number): boolean => spans.some((span) => span.start <= at && at < span.end);
