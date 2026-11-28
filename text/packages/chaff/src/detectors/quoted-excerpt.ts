// Quotations that mark an omission (… or * * *) inside them: an excerpt of another text, such as a statute quoted in a
// ruling. A list inside one is punctuated by that text, not by the writer. Pure.
import type { Token } from "../plugin.ts";

type Span = { readonly start: number; readonly end: number };

/** Room for a closing mark the sentence's last token leaves outside (law * * *.'). */
const CLOSING_REACH = 2;

/** The marks that open and close a quotation, by family. A straight mark both opens and closes. */
const OPENING: ReadonlyMap<string, string> = new Map([
  ["“", "double"],
  ['"', "double"],
  ["‘", "single"],
  ["'", "single"],
]);
const CLOSING: ReadonlyMap<string, string> = new Map([
  ["”", "double"],
  ['"', "double"],
  ["’", "single"],
  ["'", "single"],
]);

const WORD_CHAR = /[\p{L}\p{N}]/u;
const SPACE = /\s/u;

const isWordChar = (char: string): boolean => WORD_CHAR.test(char);

/** An opening mark follows no letter and precedes no space; a closing one follows no space and precedes no letter (don't). */
const opensAt = (text: string, at: number): boolean => !isWordChar(text.charAt(at - 1)) && at + 1 < text.length && !SPACE.test(text.charAt(at + 1));

const closesAt = (text: string, at: number): boolean => at > 0 && !SPACE.test(text.charAt(at - 1)) && !isWordChar(text.charAt(at + 1));

type Scan = { readonly spans: Span[]; open: { readonly family: string; readonly at: number } | undefined };

const step = (text: string, scan: Scan, char: string, at: number): Scan => {
  const { open } = scan;
  if (open !== undefined && CLOSING.get(char) === open.family && closesAt(text, at)) {
    scan.spans.push({ start: open.at, end: at + 1 });
    scan.open = undefined;
  } else if (open === undefined && OPENING.has(char) && opensAt(text, at)) {
    scan.open = { family: OPENING.get(char) ?? "", at };
  }
  return scan;
};

/** The quotations in a text, each from its opening mark to its closing mark. Quotations do not nest here. */
export const quotationsIn = (text: string): Span[] =>
  text.split("").reduce<Scan>((scan, char, at) => step(text, scan, char, at), { spans: [], open: undefined }).spans;

/** The spans of the quotations in a stretch of the source that hold one of the elision marks, as offsets in the source. */
export const excerptSpans = (source: string, from: number, to: number, marks: readonly string[]): Span[] => {
  const text = source.slice(from, to);
  return quotationsIn(text)
    .filter((span) => marks.some((mark) => mark !== "" && text.slice(span.start + 1, span.end - 1).includes(mark)))
    .map((span) => ({ start: from + span.start, end: from + span.end }));
};

/** For each token of a sentence, whether it stands inside a quoted excerpt. */
export const inExcerpt = (tokens: readonly Token[], source: string, marks: readonly string[]): ((at: number) => boolean) => {
  const [first, last] = [tokens[0], tokens.at(-1)];
  if (first === undefined || last === undefined || marks.length === 0) return () => false;
  const spans = excerptSpans(source, first.span.start, last.span.end + CLOSING_REACH, marks);
  return (at) => {
    const offset = tokens[at]?.span.start ?? -1;
    return spans.some((span) => offset > span.start && offset < span.end);
  };
};
