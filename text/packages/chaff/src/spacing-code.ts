import type { Span } from "./plugin.ts";

// Text beside which a space is not a spacing choice: a clock time (13:30), which like 3時 names a time rather than a
// quantity, and an e-mail address or a URL, whose end a reader and an auto-linker find by the space after it. Pure.

/** A clock time: hours, a colon, minutes, and seconds optionally (9:05, 13:30, 08:00:15). */
const CLOCK_TIME = /(?<![\d:：.])\d{1,2}[:：][0-5]\d(?:[:：][0-5]\d)?(?![\d:：])/gu;

/** An e-mail address, or a URL with its scheme or www: ASCII only, so it ends where Japanese text starts (…/faq で). */
const ADDRESS = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+|(?:https?:\/\/|www\.)[!-'*-~]+/gu;

const spansOf = (text: string, pattern: RegExp): Span[] => [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

export const clockTimeSpans = (text: string): Span[] => spansOf(text, CLOCK_TIME);

export const addressSpans = (text: string): Span[] => spansOf(text, ADDRESS);

/** Whether the character at `at` is inside one of the spans. */
export const isInsideSpan = (spans: readonly Span[], at: number): boolean => spans.some((span) => span.start <= at && at < span.end);
