import type { Detector, Finding, Lexicon, Sentence, Token } from "../plugin.ts";

/**
 * 比べる相手の無い比較（より良い結果、さらに高速に、The new engine is faster.）。何より良いのか、何より速いのかが書かれていない。
 * 語は語彙表 comparative-baseline が言う。group marker は日本語の比べる副詞（より、さらに）、more は英語の比べる語、comparative は比べた形の語
 * （faster、better）、baseline は相手を言う語（従来、以前、than、previous）、exempt は比較でない決まった言い方（より多くの、より詳しく）。
 * 同じ文か直前の文に相手を言う語があれば、相手は書いてある。
 */

export type ComparativeLists = {
  readonly markers: ReadonlySet<string>;
  readonly more: ReadonlySet<string>;
  readonly comparatives: ReadonlySet<string>;
  readonly baselines: readonly string[];
  readonly exempt: ReadonlySet<string>;
};

export type BareComparative = { readonly first: Token; readonly last: Token };

/** 前に立てば、比べた形が述語として読める語の品詞（is faster、runs faster）。 */
const PREDICATE_HEAD = new Set(["VERB", "AUX"]);
/** 比べた形の後ろで節が終わる印。 */
const CLAUSE_END = new Set([".", "!", "?", ",", ";", ":"]);
/** 述語と比べた形のあいだに挟まってよい副詞の数（is now much faster）。 */
const MAX_ADVERBS = 2;
/** 日本語の形容動詞の語幹の後ろに来る語（高速な、高速に、高速です）。 */
const ADJECTIVAL_TAIL = new Set(["な", "に", "だ", "です", "で"]);

const lower = (token: Token | undefined): string => token?.surface.toLowerCase() ?? "";

const isThirdPersonVerb = (token: Token): boolean => token.pos === "NOUN" && token.features?.["AlsoVerb"] === "Yes" && token.features["Number"] === "Plur";

/** 比べる語の後ろの、程度を言える語（良い、高速な）。形容詞か、形容動詞の語幹。 */
const isGradable = (tokens: readonly Token[], at: number): boolean => {
  const word = tokens[at];
  if (word?.pos === "ADJ") return true;
  return word?.pos === "NOUN" && word.features?.["Bound"] !== "Yes" && ADJECTIVAL_TAIL.has(tokens[at + 1]?.surface ?? "");
};

/** 比べる副詞が語の頭に立つか。前が助詞・記号・接続の語か文の頭のときだけ（「学年だより等」の「より」は語の一部）。 */
const OPENS_WORD = new Set(["ADP", "PUNCT", "SCONJ", "CCONJ", "ADV"]);

/** 日本語: 副詞の「より」「さらに」の直後の、程度を言える語。比較の決まった言い方（より多くの）は除く。 */
const markedAt = (tokens: readonly Token[], at: number, lists: ComparativeLists): BareComparative | undefined => {
  const [marker, word] = [tokens[at], tokens[at + 1]];
  if (marker?.pos !== "ADV" || !lists.markers.has(marker.surface) || word === undefined || lists.exempt.has(word.surface)) return undefined;
  const previous = tokens[at - 1];
  if (previous !== undefined && !OPENS_WORD.has(previous.pos)) return undefined;
  return isGradable(tokens, at + 1) ? { first: marker, last: word } : undefined;
};

/** 英語: 述語の後ろで節を閉じる比べた形（is faster.、runs faster,）か、more と形容詞。 */
const predicateAt = (tokens: readonly Token[], at: number, lists: ComparativeLists): BareComparative | undefined => {
  const word = tokens[at];
  if (word === undefined || !CLAUSE_END.has(tokens[at + 1]?.surface ?? ".")) return undefined;
  const isMore = lists.more.has(lower(tokens[at - 1])) && word.pos === "ADJ";
  if (!isMore && !lists.comparatives.has(lower(word))) return undefined;
  const first = isMore ? (tokens[at - 1] ?? word) : word;
  const start = tokens.indexOf(first);
  const adverbs = tokens.slice(Math.max(0, start - MAX_ADVERBS), start).reverse();
  const skipped = adverbs.findIndex((token) => token.pos !== "ADV");
  const head = tokens[start - 1 - (skipped === -1 ? adverbs.length : skipped)];
  return head !== undefined && (PREDICATE_HEAD.has(head.pos) || isThirdPersonVerb(head)) ? { first, last: word } : undefined;
};

export const bareComparativesIn = (tokens: readonly Token[], lists: ComparativeLists): BareComparative[] =>
  tokens.flatMap((_, at) => markedAt(tokens, at, lists) ?? predicateAt(tokens, at, lists) ?? []);

/** 文の中に、比べる相手を言う語があるか。英語は語の切れ目で、日本語は字の並びで照らす。 */
export const namesBaseline = (sentence: Sentence | undefined, baselines: readonly string[]): boolean => {
  if (sentence === undefined) return false;
  const tokens = sentence.tokens ?? [];
  const words = new Set(tokens.map((token) => token.surface.toLowerCase()));
  const comparesWithParticle = tokens.some((token) => token.surface === "より" && token.pos === "ADP");
  return comparesWithParticle || baselines.some((baseline) => words.has(baseline) || (!/^[a-z]/u.test(baseline) && sentence.text.includes(baseline)));
};

const groupOf = (lexicon: Lexicon, group: string): string[] => lexicon.filter((entry) => entry.group === group).map((entry) => entry.pattern.toLowerCase());

export const listsOf = (lexicon: Lexicon): ComparativeLists => ({
  markers: new Set(groupOf(lexicon, "marker")),
  more: new Set(groupOf(lexicon, "more")),
  comparatives: new Set(groupOf(lexicon, "comparative")),
  baselines: groupOf(lexicon, "baseline"),
  exempt: new Set(groupOf(lexicon, "exempt")),
});

export const bareComparative: Detector = (doc): Finding[] => {
  const lists = listsOf(doc.lexicons["comparative-baseline"] ?? []);
  return doc.sentences.flatMap((sentence, at) => {
    if (sentence.embeddedLanguage !== undefined || namesBaseline(sentence, lists.baselines) || namesBaseline(doc.sentences[at - 1], lists.baselines)) return [];
    return bareComparativesIn(sentence.tokens ?? [], lists).map((found) => ({
      rule: "",
      severity: "info",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { matched: doc.source.slice(found.first.span.start, found.last.span.end), offset: found.first.span.start },
    }));
  });
};
