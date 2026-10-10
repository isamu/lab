import type { Span } from "./plugin.ts";
import { HYPHEN_CHARS } from "./orthography.ts";

// Text beside which a space is not a spacing choice: a clock time (13:30), which like 3時 names a time rather than a
// quantity, an e-mail address or a URL, whose end a reader and an auto-linker find by the space after it, and an
// identifier such as a booking or model number (MN-48215, SB-210), which a space sets off from the sentence. Pure.

/** A clock time: hours, a colon, minutes, and seconds optionally (9:05, 13:30, 08:00:15). */
const CLOCK_TIME = /(?<![\d:：.])\d{1,2}[:：][0-5]\d(?:[:：][0-5]\d)?(?![\d:：])/gu;

/** A run of printable ASCII without brackets: an address ends where Japanese text, a space or a bracket starts (…/faq で). */
const ASCII_RUN = /[!-'*-~]+/gu;

/** An e-mail address (a local part, @, and a domain with a dot) or a URL with its scheme or www. */
const EMAIL = /^[\w.+-]+@[\w-]+\.[\w.-]+$/u;
const URL_START = /^(?:https?:\/\/|www\.)/u;

const isAddress = (word: string): boolean => EMAIL.test(word) || URL_START.test(word);

/**
 * An identifier: letters and digits joined by hyphens with three digits or more in a row (MN-48215, SB-210, KM-SP300), or
 * capitals followed by four digits or more (A1234567). A shorter name with a digit (EC2, H30, UTF-8, COVID-19) is a word
 * the writer spaces like any other.
 */
// The hyphen may be full-width or Japanese (KM－SP300), as in the hyphenated numbers orthography.ts reads.
const HYPHENATED = new RegExp(
  `(?<![A-Za-z0-9.${HYPHEN_CHARS}])[A-Za-z0-9]+(?:[${HYPHEN_CHARS}][A-Za-z0-9]+)+(?![A-Za-z0-9${HYPHEN_CHARS}]|\\.[A-Za-z0-9])`,
  "gu",
);
const CAPITALS_SERIAL = new RegExp(`(?<![A-Za-z0-9.${HYPHEN_CHARS}])[A-Z]+\\d{4,}(?![A-Za-z0-9${HYPHEN_CHARS}]|\\.[A-Za-z0-9])`, "gu");
const HAS_LETTER = /[A-Za-z]/u;
const SERIAL_DIGITS = /\d{3}/u;

const spansOf = (text: string, pattern: RegExp): Span[] =>
  [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

export const clockTimeSpans = (text: string): Span[] => spansOf(text, CLOCK_TIME);

export const addressSpans = (text: string): Span[] => spansOf(text, ASCII_RUN).filter((span) => isAddress(text.slice(span.start, span.end)));

const isIdentifier = (word: string): boolean => HAS_LETTER.test(word) && SERIAL_DIGITS.test(word);

export const identifierSpans = (text: string): Span[] =>
  [...spansOf(text, HYPHENATED), ...spansOf(text, CAPITALS_SERIAL)].filter((span) => isIdentifier(text.slice(span.start, span.end)));

/** Whether the character at `at` is inside one of the spans. */
export const isInsideSpan = (spans: readonly Span[], at: number): boolean => spans.some((span) => span.start <= at && at < span.end);
