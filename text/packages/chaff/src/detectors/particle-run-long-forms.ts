import type { Span, Token } from "../plugin.ts";

// The long form a writer gives a short name to (性犯罪・性暴力の被害者のためのワンストップ支援センター（以下「ワンストップ支援センター」
// という）): the long form is a name the writer cannot rephrase, so its particles are read as one noun, like a quoted title.
// Pure: the words that open such an aside (以下) and what keeps a phrase going come in.

const OPENING = /[（(]\s*/gu;

/** Where the asides that give a short name open in text (the bracket's offset), each opened by one of markers. */
const namingAsides = (text: string, markers: readonly string[]): number[] =>
  [...text.matchAll(OPENING)]
    .filter((open) => markers.some((marker) => marker !== "" && text.startsWith(marker, open.index + open[0].length)))
    .map((open) => open.index);

/** The words written straight before at, back to the first one that does not continue the phrase. */
const phraseBefore = (tokens: readonly Token[], at: number, continues: (token: Token) => boolean): Span | undefined => {
  const last = tokens.findLastIndex((token) => token.span.end <= at);
  if (last === -1 || tokens[last]?.span.end !== at) return undefined;
  const stop = tokens.slice(0, last + 1).findLastIndex((token) => !continues(token));
  const first = tokens[stop + 1];
  return first === undefined || stop === last ? undefined : { start: first.span.start, end: at };
};

/**
 * The long forms named by an aside in a sentence (text starting at offset in the document, tokens in document offsets).
 * markers: the words that open a naming aside (以下). continues: whether a word belongs to the phrase (a noun, the nesting の).
 */
export const namedLongForms = (
  text: string,
  offset: number,
  tokens: readonly Token[],
  markers: readonly string[],
  continues: (token: Token) => boolean,
): Span[] => namingAsides(text, markers).flatMap((at) => phraseBefore(tokens, offset + at, continues) ?? []);
