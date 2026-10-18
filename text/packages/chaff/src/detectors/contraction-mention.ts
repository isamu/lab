import { quotedSpans } from "../quoted-span.ts";

// A short phrase in quotation marks ("Do Not Disturb", ‘we’re going to x’) is a name or an example: the form is mentioned,
// not used, so it says nothing about the document's register. Spoken words carry punctuation ("We don't know," she
// said) and stay. The text must already have straight apostrophes, so a ’ left in it closes a quotation.

const MENTION_MARKS: Readonly<Record<string, string>> = { "“": "”", '"': '"', "‘": "’" };
/** More words than this in quotation marks is a quoted sentence, not a phrase named as an example. */
const MAX_MENTION_WORDS = 4;
const PHRASE = /^[\p{L}' ]+$/u;

const isMention = (quoted: string): boolean => {
  const phrase = quoted.trim();
  return PHRASE.test(phrase) && phrase.split(/\s+/u).length <= MAX_MENTION_WORDS;
};

/** The text with each quoted short phrase blanked out, every other character at its place. */
export const withoutMentions = (text: string): string => {
  const mentions = quotedSpans(text, MENTION_MARKS).filter((span) => isMention(text.slice(span.start, span.end)));
  if (mentions.length === 0) return text;
  const units = text.split("");
  mentions.forEach((span) => units.fill(" ", span.start, span.end));
  return units.join("");
};
