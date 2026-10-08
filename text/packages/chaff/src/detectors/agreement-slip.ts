import type { Detector, Finding, Lexicon, Token } from "../plugin.ts";
import { isPartOfLongerWord } from "./doubled-word.ts";

/**
 * 語の形が合っていない（a significant changes / one of the most important feature / Your can check）。
 * 書き換えで片方の語だけ直した跡。解析器の読みが一通りに決まる形だけを数える。語はすべてアダプタの語彙表から来る。
 */

export type AgreementLists = {
  /** 一つを数える限定詞（a / each）。 */
  readonly singular: Lexicon;
  /** 複数を数える限定詞と句（these / one of the）。 */
  readonly plural: Lexicon;
  /** 単数と複数が同じ綴りの名詞（series / data）。 */
  readonly invariant: ReadonlySet<string>;
  /** 単数の限定詞で複数を数える形容詞（a few days）。 */
  readonly count: ReadonlySet<string>;
  /** 名詞の前にしか立たない所有の語（your / their）。 */
  readonly possessive: ReadonlySet<string>;
  /** 名詞にならない be / have の形（is / has）。 */
  readonly finite: ReadonlySet<string>;
  /** 単数で書く所を複数で書いた句（ones of the most）。 */
  readonly misnumbered: Lexicon;
};

export type Slip = { readonly variant: "number" | "possessive"; readonly first: Token; readonly last: Token; readonly word: string };

const SPACE_ONLY = /^\s+$/u;
const UPPER_START = /^\p{Lu}/u;
const LETTER = /\p{L}/u;
const LOWER = /\p{Ll}/u;
/** 名詞句を閉じる記号。読点・括弧の始まり・ハイフンは、名詞を重ねた語（a sales, marketing and support team）の途中にも立つ。 */
const CLOSING_MARK = new Set([".", ";", ":", "?", "!", ")"]);
/**
 * 名詞の後ろに来れば、名詞句はそこで終わっている品詞。名詞・形容詞・接続詞・所有の印は、名詞を重ねた語の途中。
 * 動詞は、名詞にならない be / have の形（is / has）だけ。解析器は複数の名詞の後ろの名詞を動詞と読む（a sales team の team が VBP）。
 */
const PHRASE_END = new Set(["AUX", "ADP", "SCONJ", "PRON", "DET", "ADV"]);
const PREDICATE_TAIL = new Set(["DET", "ADJ", "PRON", "NUM"]);

const lower = (token: Token): string => token.surface.toLowerCase();

const isParticiple = (token: Token): boolean => token.features?.["VerbForm"] === "Part" || token.features?.["VerbForm"] === "Ger";

const isArticle = (token: Token): boolean => token.features?.["PronType"] === "Art";

const isPlural = (token: Token): boolean => token.features?.["Number"] === "Plur";

/** 名詞の後ろの語で、名詞句が終わるか。分詞（a data driven approach）も名詞を重ねた語の途中。 */
export const endsNounPhrase = (next: Token | undefined, finite: ReadonlySet<string>): boolean => {
  if (next === undefined || finite.has(lower(next))) return true;
  return next.pos === "PUNCT" ? CLOSING_MARK.has(next.surface) : PHRASE_END.has(next.pos);
};

const wordsOf = (entry: Lexicon[number]): readonly string[] =>
  entry.tokens === undefined ? entry.pattern.toLowerCase().split(/\s+/u) : entry.tokens.map((token) => token.surface.toLowerCase());

/** tokens の at 語目から始まる語彙表の句の長さ。無ければ 0。 */
const phraseAt = (tokens: readonly Token[], at: number, phrases: Lexicon): number => {
  const matched = phrases.map(wordsOf).find((words) => words.every((word, k) => tokens[at + k]?.surface.toLowerCase() === word));
  return matched?.length ?? 0;
};

/** first から last まで、語のあいだが空白だけ。コードの印やリンクを挟めば別々の語。 */
const joinedBySpace = (source: string, tokens: readonly Token[]): boolean =>
  tokens.slice(1).every((token, k) => SPACE_ONLY.test(source.slice(tokens[k]?.span.end ?? token.span.start, token.span.start)));

const opensSentence = (tokens: readonly Token[], at: number): boolean => !tokens.slice(0, at).some((token) => LETTER.test(token.surface));

/** 文の途中の大文字の限定詞は、名前の一部（Plan A users）。 */
const isNamePart = (tokens: readonly Token[], at: number): boolean => UPPER_START.test(tokens[at]?.surface ?? "") && !opensSentence(tokens, at);

const isModifier = (token: Token): boolean => token.pos === "ADJ" || token.pos === "ADV" || (token.pos === "VERB" && isParticiple(token));

/** 限定詞の後ろの修飾語。数の形容詞（a few days）が挟まれば、単数の限定詞でも複数を数えるので undefined。 */
const modifiersAfter = (tokens: readonly Token[], from: number, count: ReadonlySet<string>): readonly Token[] | undefined => {
  const end = tokens.findIndex((token, index) => index >= from && !isModifier(token));
  const modifiers = tokens.slice(from, end === -1 ? tokens.length : end);
  return modifiers.some((token) => count.has(lower(token))) ? undefined : modifiers;
};

const isGuessed = (token: Token): boolean => token.features?.["Guess"] === "Yes";

/** 単数と複数が同じ綴りの語、複数と付いても原形が同じ語（lens）、解析器が形から当てた語（stimuli）は、どちらの数とも決まらない。 */
const hasOneNumber = (noun: Token, invariant: ReadonlySet<string>): boolean =>
  !invariant.has(lower(noun)) && !isGuessed(noun) && !(isPlural(noun) && noun.lemma?.toLowerCase() === lower(noun));

const isCommonNoun = (token: Token | undefined): token is Token => token?.pos === "NOUN" && !UPPER_START.test(token.surface);

type Determiner = { readonly head: Token; readonly length: number; readonly plural: boolean };

const determinerAt = (tokens: readonly Token[], at: number, lists: AgreementLists): Determiner | undefined => {
  const head = tokens[at];
  const plural = phraseAt(tokens, at, lists.plural);
  const singular = phraseAt(tokens, at, lists.singular);
  if (head === undefined || plural + singular === 0) return undefined;
  return plural > 0 ? { head, length: plural, plural: true } : { head, length: singular, plural: false };
};

/**
 * 冠詞と句でない限定詞（this / these）は代名詞にもなる。This results in a loss の results は動詞なので、
 * 形容詞を挟んだ名詞（this new rules）だけを数える。
 */
const standsAlone = (determiner: Determiner): boolean => determiner.length === 1 && !isArticle(determiner.head);

const readsAsDeterminer = (determiner: Determiner, modifiers: readonly Token[]): boolean =>
  !standsAlone(determiner) || modifiers.some((token) => token.pos === "ADJ");

const mayBeNoun = (token: Token): boolean => token.features?.["AlsoNoun"] === "Yes" || isGuessed(token);

/**
 * 名詞が動詞にも読め（works）、その前に名詞句の頭になれる語があれば、限定詞と名詞ではなく主語と動詞かもしれない。
 * an individual works（individual は名詞にもなる）/ Those responsible report to the board（those は代名詞にもなる）。
 * 後ろが is / has なら、名詞は動詞ではない（these key result is）。
 */
const mayBeVerb = (determiner: Determiner, modifiers: readonly Token[], noun: Token, next: Token | undefined, finite: ReadonlySet<string>): boolean =>
  noun.features?.["AlsoVerb"] === "Yes" && !(next !== undefined && finite.has(lower(next))) && (standsAlone(determiner) || modifiers.some(mayBeNoun));

/** 冠詞は名詞句の頭に立つ。形容詞や数の後ろの a は、記号の名前（the eight 3-hourly a indices）。 */
const AFTER_MODIFIER = new Set(["ADJ", "NUM"]);

const isLetterName = (tokens: readonly Token[], at: number, determiner: Determiner): boolean =>
  isArticle(determiner.head) && determiner.head.surface.length === 1 && AFTER_MODIFIER.has(tokens[at - 1]?.pos ?? "");

const numberSlipAt = (source: string, tokens: readonly Token[], at: number, lists: AgreementLists): Slip | undefined => {
  const determiner = determinerAt(tokens, at, lists);
  if (determiner === undefined || isNamePart(tokens, at) || isLetterName(tokens, at, determiner)) return undefined;
  const modifiers = modifiersAfter(tokens, at + determiner.length, lists.count);
  if (modifiers === undefined || !readsAsDeterminer(determiner, modifiers)) return undefined;
  const nounAt = at + determiner.length + modifiers.length;
  const noun = tokens[nounAt];
  if (!isCommonNoun(noun) || !hasOneNumber(noun, lists.invariant) || isPlural(noun) === determiner.plural) return undefined;
  if (mayBeVerb(determiner, modifiers, noun, tokens[nounAt + 1], lists.finite)) return undefined;
  const span = tokens.slice(at, nounAt + 1);
  if (!endsNounPhrase(tokens[nounAt + 1], lists.finite) || !joinedBySpace(source, span) || isPartOfLongerWord(source, determiner.head, noun)) return undefined;
  return slipOf("number", source, determiner.head, noun);
};

const slipOf = (variant: Slip["variant"], source: string, first: Token, last: Token): Slip => ({
  variant,
  first,
  last,
  word: source.slice(first.span.start, last.span.end).replace(/\s+/gu, " "),
});

const isBaseVerb = (token: Token | undefined): boolean => token?.pos === "VERB" && token.features?.["VerbForm"] === undefined;

/** 所有の語の直後の be（their is）か、助動詞 + 動詞の原形（Your can check）。名詞にもなる助動詞（your will）は動詞が続くときだけ。 */
const possessiveSlipAt = (source: string, tokens: readonly Token[], at: number, lists: AgreementLists): Slip | undefined => {
  const [possessive, verb] = [tokens[at], tokens[at + 1]];
  if (possessive === undefined || verb === undefined || !lists.possessive.has(lower(possessive))) return undefined;
  // 大文字だけの語は略語（Your AM = account manager）。
  const verbal = LOWER.test(verb.surface) && (lists.finite.has(lower(verb)) || (verb.pos === "AUX" && isBaseVerb(tokens[at + 2])));
  if (!verbal || !joinedBySpace(source, [possessive, verb]) || isPartOfLongerWord(source, possessive, verb)) return undefined;
  return slipOf("possessive", source, possessive, verb);
};

/** ones of the most。前に限定詞・形容詞・代名詞があれば、ones は代名詞（the ones of the most use）。 */
const misnumberedAt = (source: string, tokens: readonly Token[], at: number, lists: AgreementLists): Slip | undefined => {
  const span = tokens.slice(at, at + phraseAt(tokens, at, lists.misnumbered));
  const [first, last, previous] = [span[0], span.at(-1), tokens[at - 1]];
  if (first === undefined || last === undefined || (previous !== undefined && PREDICATE_TAIL.has(previous.pos))) return undefined;
  return joinedBySpace(source, span) ? slipOf("number", source, first, last) : undefined;
};

export const agreementIn = (source: string, tokens: readonly Token[], lists: AgreementLists): Slip[] =>
  tokens.flatMap((_, at) => {
    const slip = numberSlipAt(source, tokens, at, lists) ?? possessiveSlipAt(source, tokens, at, lists) ?? misnumberedAt(source, tokens, at, lists);
    return slip === undefined ? [] : [slip];
  });

const setOf = (lexicon: Lexicon | undefined): ReadonlySet<string> => new Set((lexicon ?? []).map((entry) => entry.pattern.toLowerCase()));

const listsOf = (lexicons: Readonly<Record<string, Lexicon>>): AgreementLists => ({
  singular: lexicons["singular-determiner"] ?? [],
  plural: lexicons["plural-determiner"] ?? [],
  invariant: setOf(lexicons["invariant-noun"]),
  count: setOf(lexicons["count-adjective"]),
  possessive: setOf(lexicons["dependent-possessive"]),
  finite: setOf(lexicons["finite-auxiliary"]),
  misnumbered: lexicons["misnumbered-phrase"] ?? [],
});

export const agreementSlip: Detector = (doc): Finding[] => {
  const lists = listsOf(doc.lexicons);
  return doc.sentences.flatMap((sentence) =>
    agreementIn(doc.source, sentence.tokens ?? [], lists).map((slip): Finding => ({
      rule: "agreement-slip",
      severity: "warning",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { word: slip.word, offset: slip.first.span.start },
      variant: slip.variant,
    })),
  );
};
