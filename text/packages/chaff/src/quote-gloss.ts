// A bracket written straight after a closing quotation mark: the quotation's reading or translation (「天子有道」（天子に道有らば）).
// It renders the quoted text and keeps the quoted text's words and spelling, not the writer's. Pure.

import type { Span } from "./plugin.ts";

/** A Japanese quotation's closing mark, then a bracket that closes on the same text. */
const GLOSS_AFTER_QUOTE = /[」』][（(][^（）()]*[）)]/gu;

/** Where each bracket written straight after a closing quotation mark lies in text, the brackets included. */
export const quoteGlossSpans = (text: string): Span[] =>
  [...text.matchAll(GLOSS_AFTER_QUOTE)].map((match) => ({ start: match.index + 1, end: match.index + match[0].length }));
