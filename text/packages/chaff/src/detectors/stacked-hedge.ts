import type { Lexicon, Sentence, Span, Token } from "../plugin.ts";
import { entryRanges, type TokenRange } from "./lexicon-match.ts";
import { isWithinAny, quotedIn, QUOTATION_MARKS } from "../quoted-span.ts";

/** 重ねたと言うのに要る数。1 つなら慎重さで、2 つ目からは読み手が何を言い切ったのか分からなくなる。 */
export const STACKED_AT = 2;

/**
 * 語彙表 3 つ。hedges は逃げの表現そのもの、frames はそれだけでは逃げていない包む言い方（「という状況です」、may）、
 * scope は hedges のうち、どれだけ確かかではなくどこで成り立つかを言うもの（「場合がある」、in some cases）。
 */
export type HedgeWords = { readonly hedges: Lexicon; readonly frames: Lexicon; readonly scope: Lexicon };

type Device = { readonly range: TokenRange; readonly hedge: boolean };

export type StackedHedge = { readonly sentence: Sentence; readonly spans: readonly Span[] };

const rangesOf = (sentence: Sentence, lexicon: Lexicon): TokenRange[] => lexicon.flatMap((entry) => entryRanges(sentence, entry));

const contains = (outer: TokenRange, inner: TokenRange): boolean => outer.start <= inner.start && inner.end <= outer.end;

const sameRange = (left: TokenRange, right: TokenRange): boolean => left.start === right.start && left.end === right.end;

/**
 * 同じ語に当たった見出しは 1 つに数える。「could」は「it could be」の一部。
 * 同じ範囲に hedge と frame が両方当たったら hedge として残す（devices は hedge が先に並んでいる）。
 */
const outermost = (devices: readonly Device[]): Device[] =>
  devices.filter(
    (device, index) =>
      !devices.some((other, at) => at !== index && contains(other.range, device.range) && (!sameRange(other.range, device.range) || at < index)),
  );

/** 語の並びの、文書全体の座標での範囲。 */
const spanOf = (tokens: readonly Token[], range: TokenRange): Span | undefined => {
  const first = tokens[range.start];
  const last = tokens[range.end - 1];
  return first === undefined || last === undefined ? undefined : { start: first.span.start, end: last.span.end };
};

/** 句読点と等位接続詞（and、but、及び）は節を切る。別の節の逃げは、同じ主張を二重にぼかしていない。 */
const CLAUSE_BREAK = new Set(["PUNCT", "CCONJ"]);

/** 語ごとの、文の頭から数えた節の番号。 */
const clauseOf = (tokens: readonly Token[]): number[] =>
  tokens.reduce<number[]>((clauses, token) => [...clauses, (clauses.at(-1) ?? 0) + (CLAUSE_BREAK.has(token.pos) ? 1 : 0)], []);

const PREDICATE = new Set(["VERB", "AUX"]);

/** 見せる範囲。活用する語で終わる見出し（と考えられる）は、後ろの助動詞（ます）まで含めて書いたとおりに見せる。 */
const shownEnd = (tokens: readonly Token[], range: TokenRange): number => {
  const last = tokens[range.end - 1];
  if (last === undefined || !PREDICATE.has(last.pos)) return range.end;
  const stop = tokens.findIndex((token, at) => at >= range.end && token.pos !== "AUX");
  return stop === -1 ? tokens.length : stop;
};

/** 書き手の言葉で、どこで成り立つかを言う語ではない見出し。引用（「」『』“” "）の中は話し手の言葉。 */
const devicesIn = (sentence: Sentence, words: HedgeWords): Device[] => {
  const tokens = sentence.tokens ?? [];
  const quoted = quotedIn(sentence, QUOTATION_MARKS);
  const scope = rangesOf(sentence, words.scope);
  const hedges = rangesOf(sentence, words.hedges).filter((range) => !scope.some((outer) => contains(outer, range)));
  const devices = [...hedges.map((range) => ({ range, hedge: true })), ...rangesOf(sentence, words.frames).map((range) => ({ range, hedge: false }))];
  return outermost(devices).filter((device) => {
    const span = spanOf(tokens, device.range);
    return span !== undefined && !isWithinAny(quoted, span);
  });
};

/** 1 つの節に 2 つ以上あり、そのうち 1 つ以上が逃げの表現そのもの。包む言い方だけ（「という状況です」）は逃げていない。 */
const stackedClause = (devices: readonly Device[], clauses: readonly number[]): Device[] => {
  const clauseAt = (device: Device): number => clauses[device.range.start] ?? 0;
  const groups = [...new Set(devices.map(clauseAt))].map((clause) => devices.filter((device) => clauseAt(device) === clause));
  return groups.find((group) => group.length >= STACKED_AT && group.some((device) => device.hedge)) ?? [];
};

/**
 * 1 つの文の 1 つの節に、逃げの表現を重ねているか。business-blog-harness-spec §7.2。見せる範囲を文の中の順で返す。重ねていなければ空。
 * 品詞が無ければ語の位置が分からないので何も言わない。
 */
export const stackedHedgeIn = (sentence: Sentence, words: HedgeWords): Span[] => {
  const tokens = sentence.tokens ?? [];
  return stackedClause(devicesIn(sentence, words), clauseOf(tokens))
    .toSorted((left, right) => left.range.start - right.range.start)
    .flatMap((device) => spanOf(tokens, { start: device.range.start, end: shownEnd(tokens, device.range) }) ?? []);
};

export const stackedHedges = (sentences: readonly Sentence[], words: HedgeWords): StackedHedge[] =>
  sentences.flatMap((sentence) => {
    const spans = stackedHedgeIn(sentence, words);
    return spans.length === 0 ? [] : [{ sentence, spans }];
  });
