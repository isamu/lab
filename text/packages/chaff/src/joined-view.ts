import { withoutSpans } from "./soft-break.ts";
import { continuedBreaks, wrapBreaks } from "./line-continues.ts";
import type { Segmentation, Sentence, Span, Token } from "./plugin.ts";

/**
 * 消える改行を取り除いた文字列と、その上の範囲を元の文字列の範囲に戻す写像。
 *
 * 解析はつないだ文字列で行い、指摘の位置は元の文字列で出す。行・列も、引用して見せる範囲も、元の文書のまま。
 */
export type JoinedView = { readonly text: string; readonly toSource: (span: Span) => Span };

type Removed = { readonly at: number; readonly removedBefore: number };

/** 取り除いた各範囲が、つないだ文字列のどこにあったか。removedBefore はそこまでに取り除いた長さ（その範囲を含む）。 */
const removedPlaces = (breaks: readonly Span[]): Removed[] =>
  breaks.reduce<Removed[]>((acc, span) => {
    const before = acc.at(-1)?.removedBefore ?? 0;
    return [...acc, { at: span.start - before, removedBefore: before + span.end - span.start }];
  }, []);

/** at が offset 以下（inclusive）または未満の、最後の範囲までに取り除いた長さ。places は at の昇順。 */
const removedUpTo = (places: readonly Removed[], offset: number, inclusive: boolean): number => {
  const search = (low: number, high: number, found: number): number => {
    if (low > high) return found;
    const middle = (low + high) >> 1;
    const place = places[middle];
    if (place === undefined) return found;
    const reached = inclusive ? place.at <= offset : place.at < offset;
    return reached ? search(middle + 1, high, place.removedBefore) : search(low, middle - 1, found);
  };
  return search(0, places.length - 1, 0);
};

/**
 * 始まりは、そこで取り除いた改行の後ろ（次の文字）へ。終わりは、そこで取り除いた改行の手前へ。
 * 改行をまたぐ語（「関\nする」）は、改行ごと覆う範囲になる。
 */
export const joinedView = (text: string, breaks: readonly Span[]): JoinedView => {
  const places = removedPlaces(breaks);
  const toSource = (span: Span): Span => {
    const start = span.start + removedUpTo(places, span.start, true);
    const end = span.end + removedUpTo(places, span.end, false);
    return { start, end: Math.max(start, end) };
  };
  return { text: withoutSpans(text, breaks), toSource };
};

const tokenInSource =
  (view: JoinedView) =>
  (token: Token): Token => ({ ...token, span: view.toSource(token.span) });

const sentenceInSource =
  (text: string, view: JoinedView) =>
  (sentence: Sentence): Sentence => {
    const span = view.toSource(sentence.span);
    return {
      span,
      text: text.slice(span.start, span.end),
      ...(sentence.tokens === undefined ? {} : { tokens: sentence.tokens.map(tokenInSource(view)) }),
    };
  };

type Segment = (text: string) => Segmentation;

/** breaks を除いて segment し、文と語の範囲を text の上に戻す。文の text は元の文字列の切り出しのまま。 */
const segmentWithout = (text: string, breaks: readonly Span[], segment: Segment): Sentence[] => {
  const view = joinedView(text, breaks);
  return segment(view.text).sentences.map(sentenceInSource(text, view));
};

const withWrapBreaks = (sentence: Sentence, breaks: readonly Span[]): Sentence => {
  const wrapped = wrapBreaks(
    breaks.filter((part) => part.start >= sentence.span.start && part.end <= sentence.span.end),
    sentence.tokens ?? [],
  );
  return wrapped.length === 0 ? sentence : { ...sentence, wrapBreaks: wrapped };
};

/**
 * 消える改行を、行が続いていると言えるものだけ除いて segment する。
 * 一度すべて除いて解析し、その語で決めて、残す改行があれば読み直す。
 * 語が無ければ（品詞を読まない adapter）決められないので、前と同じく改行ごと渡す。
 * 除く改行が無ければ segment の結果をそのまま返す。つながない段落の文は、前と同じものになる。
 */
export const segmentJoined = (text: string, breaks: readonly Span[], segment: Segment): readonly Sentence[] => {
  if (breaks.length === 0) return segment(text).sentences;
  const joined = segmentWithout(text, breaks, segment);
  const kept = continuedBreaks(
    breaks,
    joined.flatMap((sentence) => sentence.tokens ?? []),
  );
  if (kept.length === 0) return segment(text).sentences;
  const sentences = kept.length === breaks.length ? joined : segmentWithout(text, kept, segment);
  return sentences.map((sentence) => withWrapBreaks(sentence, kept));
};
