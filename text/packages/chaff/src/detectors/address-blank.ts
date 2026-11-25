import type { Lexicon } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";

type Span = { readonly start: number; readonly end: number };

/** Lexicon group of placeholder-word: a path segment of a web address a template leaves to fill (example.com/yourname/tool). */
export const ADDRESS_BLANK = "address-blank";

/** A web address, code included: a clone command in a fenced block keeps the template's user name as often as prose does. */
const WEB_ADDRESS = /https?:\/\/[^\s/<>()[\]`"']+(?:\/[^\s/<>()[\]`"']*)*/gu;
/** What may end a segment besides the next slash: a file extension (.git) or a closing stop. */
const SEGMENT_END = /[.,;:!?]/u;

const segmentsOf = (address: string, start: number): Span[] => {
  const host = address.indexOf("/", address.indexOf("//") + 2);
  if (host < 0) return [];
  return address
    .slice(host + 1)
    .split("/")
    .reduce<{ spans: Span[]; at: number }>(
      (state, segment) => {
        const cut = segment.search(SEGMENT_END);
        const word = cut < 0 ? segment : segment.slice(0, cut);
        return { spans: [...state.spans, { start: state.at, end: state.at + word.length }], at: state.at + segment.length + 1 };
      },
      { spans: [], at: start + host + 1 },
    ).spans;
};

/** Whether the word stands in the text outside web addresses, in any case. */
const mentionedOutside = (text: string, word: string): boolean => {
  const bare = text.replace(WEB_ADDRESS, " ").toLowerCase();
  return new RegExp(`(?<![\\p{L}\\p{N}_-])${escapeRegExp(word)}(?![\\p{L}\\p{N}_-])`, "u").test(bare);
};

/**
 * Path segments of web addresses that are a template's blank word whole (github.com/yourname/tool.git, YOUR_USERNAME).
 * A word the text also names outside any address (replace yourname with your account) is one the writer explains, and is meant.
 */
export const addressBlankSpans = (text: string, words: Lexicon): Span[] => {
  const blanks = new Set(words.filter((word) => word.group === ADDRESS_BLANK).map((word) => word.pattern.toLowerCase()));
  if (blanks.size === 0) return [];
  return [...text.matchAll(WEB_ADDRESS)]
    .flatMap((match) => segmentsOf(match[0], match.index))
    .filter((span) => {
      const word = text.slice(span.start, span.end).toLowerCase();
      return blanks.has(word) && !mentionedOutside(text, word);
    });
};
