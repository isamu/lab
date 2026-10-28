import type { Span } from "./plugin.ts";

// A phrase the writer repeats from a quotation in the same document (「勇気と真心をもって真実を語る」 quoted, then 勇気と真心を
// もって真実を語り in the writer's own sentence): the words of the echo keep the quotation's spelling. Pure.

/** How many characters on each side of a word are read with it: enough to tell an echo from a word that merely recurs. */
const ECHO_REACH = 4;
/** The shortest stretch, the word and its sides, that counts as an echo. */
const MIN_ECHO_LENGTH = 8;

/** The insides of the quotations in a text, as quotedSpans places them. */
export const quotationsIn = (text: string, spans: readonly Span[]): string[] => spans.map((span) => text.slice(span.start, span.end));

/** Whether the word at start..end of text, with the characters around it, stands word for word in one of the quotations. */
export const echoesQuotation = (text: string, { start, end }: Span, quotations: readonly string[]): boolean => {
  const phrase = text.slice(Math.max(0, start - ECHO_REACH), Math.min(text.length, end + ECHO_REACH));
  return phrase.length >= MIN_ECHO_LENGTH && quotations.some((quotation) => quotation.includes(phrase));
};
