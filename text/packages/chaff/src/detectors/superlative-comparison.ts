import type { Lexicon, Sentence, Span, Token } from "../plugin.ts";
import { isWithinAny, quotedIn, QUOTATION_MARKS } from "../quoted-span.ts";
import { entryEndsAt, type TokenRange } from "./lexicon-match.ts";

/**
 * 比べる相手を言う語。語彙表の position で分ける。
 * position の無い語（より・のほうが・than）は、文のどこにあっても比べる相手を言っている。
 * position: before の語（との）は、最上級のすぐ前にあるときだけ。「SES との最大の分岐点」は相手を言うが、
 * 「チームとの会議で最高の成果」の「との」は最上級と関わらない。
 */
export type ComparisonMarkers = { readonly anywhere: Lexicon; readonly before: Lexicon };

export const comparisonMarkersOf = (lexicon: Lexicon): ComparisonMarkers => ({
  anywhere: lexicon.filter((entry) => entry.position === undefined),
  before: lexicon.filter((entry) => entry.position === "before"),
});

/** 最上級のすぐ前で、比べる相手を受ける語が終わっているか。 */
export const counterpartBefore = (tokens: readonly Token[], range: TokenRange, markers: Lexicon): boolean =>
  markers.some((entry) => entryEndsAt(tokens, entry, range.start));

const spanOf = (tokens: readonly Token[], range: TokenRange): Span | undefined => {
  const first = tokens[range.start];
  const last = tokens[range.end - 1];
  return first === undefined || last === undefined ? undefined : { start: first.span.start, end: last.span.end };
};

/** 引用符や鉤括弧の中の最上級。人の言葉や題名を引いたもので、書き手が比べずに言い切ったものではない。 */
export const quotedRange = (sentence: Sentence, range: TokenRange): boolean => {
  const span = spanOf(sentence.tokens ?? [], range);
  return span !== undefined && isWithinAny(quotedIn(sentence, QUOTATION_MARKS), span);
};
