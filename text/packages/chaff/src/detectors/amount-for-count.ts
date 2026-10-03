import type { Detector, Finding, Lexicon, Token } from "../plugin.ts";
import { endsNounPhrase } from "./agreement-slip.ts";
import { isPartOfLongerWord } from "./doubled-word.ts";

/**
 * 量を言う語を、数えられる名詞の複数に付けた所（less errors、less customer complaints）。語は語彙表 amount-quantifier が言う。
 * 前が名詞か数なら「引く」の less（revenue less costs、$500 less fees）なので読まない。
 */

export type AmountLists = {
  /** 量を言う語（less）と、数を言う語（fewer, rewrite）。 */
  readonly quantifiers: Lexicon;
  /** 複数の形でも数えない名詞。単数と複数が同じ綴りの語（series）と、金額を言う複数（earnings）。 */
  readonly uncounted: ReadonlySet<string>;
  /** 名詞にならない be / have の形。名詞句がそこで終わる。 */
  readonly finite: ReadonlySet<string>;
};

export type AmountSlip = { readonly quantifier: Token; readonly noun: Token; readonly rewrite: string };

const UPPER_START = /^\p{Lu}/u;

/** 前に立てば、量の語が限定詞として読める品詞。名詞・数・記号の後ろは「引く」の less。 */
const OPENS_PHRASE = new Set(["VERB", "AUX", "ADP", "CCONJ", "SCONJ", "ADV", "PART"]);
const OPENING_MARK = new Set(["(", "[", "{", '"', "'", "“", "‘"]);

const lower = (token: Token): string => token.surface.toLowerCase();

/** 解析器は三人称の動詞を複数の名詞と読むことがある（The parser reports less errors の reports）。 */
const mayBeVerb = (token: Token): boolean => token.pos === "NOUN" && token.features?.["AlsoVerb"] === "Yes" && token.features["Number"] === "Plur";

const opensPhrase = (previous: Token | undefined): boolean =>
  previous === undefined || OPENS_PHRASE.has(previous.pos) || OPENING_MARK.has(previous.surface) || mayBeVerb(previous);

const isCommonNoun = (token: Token | undefined): token is Token =>
  token?.pos === "NOUN" && token.features?.["Guess"] !== "Yes" && !UPPER_START.test(token.surface);

const isPlural = (token: Token): boolean => token.features?.["Number"] === "Plur";

/** 複数の形がはっきりした、数えられる普通名詞。形から当てた語（stimuli）と、数えない語は読まない。 */
const isCountedPlural = (noun: Token | undefined, uncounted: ReadonlySet<string>): noun is Token =>
  isCommonNoun(noun) && isPlural(noun) && !uncounted.has(lower(noun));

/** less の後ろの名詞の頭。単数の名詞を一つ重ねた語（less customer complaints）は、その後ろの語。 */
const headAt = (tokens: readonly Token[], at: number): number => {
  const next = tokens[at + 1];
  return isCommonNoun(next) && !isPlural(next) ? at + 2 : at + 1;
};

const slipAt = (source: string, tokens: readonly Token[], at: number, lists: AmountLists): AmountSlip | undefined => {
  const quantifier = tokens[at];
  const entry = quantifier === undefined ? undefined : lists.quantifiers.find((candidate) => candidate.pattern.toLowerCase() === lower(quantifier));
  if (quantifier?.pos !== "ADJ" || entry === undefined || !opensPhrase(tokens[at - 1])) return undefined;
  const head = headAt(tokens, at);
  const noun = tokens[head];
  if (!isCountedPlural(noun, lists.uncounted) || !endsNounPhrase(tokens[head + 1], lists.finite) || isPartOfLongerWord(source, quantifier, noun))
    return undefined;
  return { quantifier, noun, rewrite: entry.rewrite ?? "" };
};

export const amountSlipsIn = (source: string, tokens: readonly Token[], lists: AmountLists): AmountSlip[] =>
  tokens.flatMap((_, at) => slipAt(source, tokens, at, lists) ?? []);

const patternsOf = (lexicon: Lexicon): string[] => lexicon.map((entry) => entry.pattern.toLowerCase());

const listsOf = (lexicons: Readonly<Record<string, Lexicon>>): AmountLists => {
  const words = lexicons["amount-quantifier"] ?? [];
  return {
    quantifiers: words.filter((entry) => entry.group === "quantifier"),
    uncounted: new Set([...patternsOf(lexicons["invariant-noun"] ?? []), ...patternsOf(words.filter((entry) => entry.group === "amount"))]),
    finite: new Set(patternsOf(lexicons["finite-auxiliary"] ?? [])),
  };
};

export const amountForCount: Detector = (doc): Finding[] => {
  const lists = listsOf(doc.lexicons);
  return doc.sentences.flatMap((sentence) =>
    amountSlipsIn(doc.source, sentence.tokens ?? [], lists).map((slip): Finding => {
      const rest = doc.source.slice(slip.quantifier.span.end, slip.noun.span.end).replace(/\s+/gu, " ");
      return {
        rule: "",
        severity: "warning",
        line: 0,
        column: 0,
        quote: sentence.text.trim(),
        values: { word: `${slip.quantifier.surface}${rest}`, suggestion: `${slip.rewrite}${rest}`, offset: slip.quantifier.span.start },
      };
    }),
  );
};
