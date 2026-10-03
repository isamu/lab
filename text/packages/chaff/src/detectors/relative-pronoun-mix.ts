import type { Detector, Finding, Lexicon, Token } from "../plugin.ts";
import { minorityOf } from "./technical-docs.ts";
import { isWithinAny, quotedIn, QUOTATION_MARKS } from "../quoted-span.ts";

/**
 * 限定の関係節を which で書く所と that で書く所が、一つの文書に混ざっている所（the file which contains / the file that contains）。
 * どちらが正しいかは決めず、少ないほうを指す。読むのは「名詞 + which|that + 動詞」の、読点を挟まない形だけ。
 * that の後ろに主語が来る形（the fact that it works）は、関係節か同格の節か語の並びで決まらないので数えない。
 */

export type RelativeUse = { readonly word: Token; readonly kind: string };

/** 多いほうの書き方が、文書の書き方と言えるだけの数。 */
const MIN_USUAL = 3;
const VERBAL = new Set(["VERB", "AUX"]);

/** 解析器は三人称の動詞を複数の名詞と読むことがある（the script that checks links の checks）。 */
const isThirdPersonVerb = (token: Token): boolean => token.pos === "NOUN" && token.features?.["AlsoVerb"] === "Yes" && token.features["Number"] === "Plur";

const isTaggedFiniteVerb = (token: Token | undefined): boolean =>
  token !== undefined && VERBAL.has(token.pos) && token.features?.["VerbForm"] !== "Part" && token.features?.["VerbForm"] !== "Ger";

/**
 * 動詞と読める語。名詞と読まれた三人称の動詞は、後ろに動詞が無いときだけ（the idea that results matter の results は主語）。
 */
const isFiniteVerb = (token: Token | undefined, next: Token | undefined): boolean =>
  isTaggedFiniteVerb(token) || (token !== undefined && isThirdPersonVerb(token) && !isTaggedFiniteVerb(next));

const isBaseForm = (verb: Token): boolean => verb.pos === "VERB" && verb.lemma?.toLowerCase() === verb.surface.toLowerCase();

/**
 * 名詞の後ろの関係節の動詞。原形の動詞は複数の名詞にだけ続く（resources which set）。単数の名詞の後ろの原形は、
 * 関係節ではなく「どの」の which（tells the command which file to use）。
 */
const opensRelative = (noun: Token | undefined, verb: Token | undefined, next: Token | undefined): boolean =>
  noun?.pos === "NOUN" && verb !== undefined && isFiniteVerb(verb, next) && (!isBaseForm(verb) || noun.features?.["Number"] === "Plur");

/** which / that の後ろの、副詞を飛ばした最初の語（the file which usually stores の stores）。 */
const verbAfter = (tokens: readonly Token[], at: number): number => {
  const found = tokens.findIndex((token, index) => index > at && token.pos !== "ADV");
  return found === -1 ? tokens.length : found;
};

/** 語彙表の組（which / that）で、tokens の中の限定の関係節の頭。 */
export const relativeUses = (tokens: readonly Token[], kinds: Lexicon): RelativeUse[] =>
  tokens.flatMap((word, at) => {
    const entry = kinds.find((candidate) => candidate.pattern.toLowerCase() === word.surface.toLowerCase());
    const verb = verbAfter(tokens, at);
    if (entry?.group === undefined || !opensRelative(tokens[at - 1], tokens[verb], tokens[verb + 1])) return [];
    return [{ word, kind: entry.group }];
  });

/** 二通りの書き方のうち少ないほう。多いほうが MIN_USUAL に満たなければ、文書の書き方と言えないので空。 */
export const oddRelatives = (uses: readonly RelativeUse[], limit: number): { readonly odd: readonly RelativeUse[]; readonly usual: string } => {
  const kinds = [...new Set(uses.map((use) => use.kind))];
  const [first, second] = kinds.map((kind) => uses.filter((use) => use.kind === kind));
  if (kinds.length !== 2 || first === undefined || second === undefined) return { odd: [], usual: "" };
  const odd = minorityOf(first, second, limit);
  const usual = odd === first ? second : first;
  return usual.length < MIN_USUAL ? { odd: [], usual: "" } : { odd, usual: usual[0]?.word.surface.toLowerCase() ?? "" };
};

export const relativePronounMix: Detector = (doc, options): Finding[] => {
  const kinds = doc.lexicons["restrictive-relative"] ?? [];
  const uses = doc.sentences.flatMap((sentence) => {
    if (sentence.embeddedLanguage !== undefined) return [];
    const quoted = quotedIn(sentence, QUOTATION_MARKS);
    return relativeUses(sentence.tokens ?? [], kinds).filter((use) => !isWithinAny(quoted, use.word.span));
  });
  const { odd, usual } = oddRelatives(uses, options.limit);
  return odd.map((use) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: doc.sentences.find((sentence) => sentence.span.start <= use.word.span.start && use.word.span.start < sentence.span.end)?.text.trim() ?? "",
    values: { word: use.word.surface, usual, count: odd.length, limit: options.limit, offset: use.word.span.start },
  }));
};
