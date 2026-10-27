import type { Detector, Finding, Lexicon, LexiconEntry, ProseDocument, Sentence, Token } from "../plugin.ts";
import { comparableWords, entryEnds, entryIn, entryRanges, type TokenRange } from "./lexicon-match.ts";
import { wordsOf } from "./structure.ts";
import { MIN_DOCUMENT_LENGTH } from "./signals.ts";

const PER = 1000;
const TENTHS = 10;
/** 一つ二つは普通の言い方。三つ目から数える。 */
const MIN_USES = 3;
/** 「everyone」だけを繰り返す文書（チームの全員）は、決まった言い方が一つあるだけで、一般化を重ねてはいない。 */
const MIN_PHRASES = 2;

/** 一つの文の、大きく括る言い方。使った回数だけ並ぶ。 */
export type SweepingSentence = { readonly sentence: Sentence; readonly phrases: readonly string[] };

/** 語彙表の組。general は常に、subject は動詞の主語のときだけ数え、who は誰のことかが近くで決まっていれば数えない。残りはその決まり方を言う語。 */
type Vocabulary = {
  readonly general: Lexicon;
  readonly subject: Lexicon;
  readonly who: Lexicon;
  readonly groupNouns: Lexicon;
  readonly addressees: Lexicon;
  readonly rightAfter: Lexicon;
  readonly presentForms: Lexicon;
  readonly relatives: Lexicon;
};

const inGroup = (lexicon: Lexicon, group: string): Lexicon => lexicon.filter((entry) => entry.group === group);

const vocabularyOf = (lexicon: Lexicon): Vocabulary => ({
  general: inGroup(lexicon, "general"),
  subject: inGroup(lexicon, "subject"),
  who: inGroup(lexicon, "who"),
  groupNouns: inGroup(lexicon, "group-noun"),
  addressees: inGroup(lexicon, "addressee"),
  rightAfter: inGroup(lexicon, "right-after"),
  presentForms: inGroup(lexicon, "present-form"),
  relatives: inGroup(lexicon, "relative"),
});

const NOMINAL = new Set(["NOUN", "PROPN"]);
const VERBAL = new Set(["VERB", "AUX", "PART"]);

const isNominal = (token: Token | undefined): boolean => NOMINAL.has(token?.pos ?? "");
const isWord = (token: Token | undefined, entries: Lexicon): boolean =>
  token !== undefined && entries.some((entry) => comparableWords(entry.pattern) === comparableWords(token.surface));

/** 後ろの名詞を飾る位置（family photos）。動詞とも読める語（family shares）は、tagger が動詞を名詞と読み違えたことがあるので数えない。 */
const modifiesNext = (next: Token | undefined): boolean => isNominal(next) && next?.features?.["AlsoVerb"] !== "Yes";

/** 人の集まりを名指す名詞が、句の中心に立つ（the team、family members）。後ろの名詞を飾るだけ（family photos）なら名指していない。 */
const headsPhrase = (tokens: readonly Token[], range: TokenRange): boolean => isNominal(tokens[range.start]) && !modifiesNext(tokens[range.end]);

/** 文が人の集まりを名指す（the team、our family、all of you）。 */
const namesGroup = (sentence: Sentence | undefined, vocabulary: Vocabulary): boolean => {
  if (sentence === undefined) return false;
  const tokens = sentence.tokens ?? [];
  const named = vocabulary.groupNouns.some((entry) => entryRanges(sentence, entry).some((range) => headsPhrase(tokens, range)));
  return named || vocabulary.addressees.some((entry) => entryIn(sentence, entry));
};

/** 規則どおりの三人称単数現在（loves、watches、tries）。 */
const isThirdPersonPresent = (surface: string, lemma: string): boolean => [`${lemma}s`, `${lemma}es`, `${lemma.replace(/y$/u, "")}ies`].includes(surface);

/** 過去形の動詞（caught、jumped、was）。原形・現在形・-ing 形は過去でない。 */
const isPastVerb = (token: Token | undefined, vocabulary: Vocabulary): boolean => {
  if (token?.pos !== "VERB" || token.lemma === undefined || token.features?.["VerbForm"] === "Ger") return false;
  const surface = token.surface.toLowerCase();
  const lemma = token.lemma.toLowerCase();
  return surface !== lemma && !isThirdPersonPresent(surface, lemma) && !isWord(token, vocabulary.presentForms);
};

/** 括る言い方のすぐ後の動詞。副詞と関係代名詞（everyone who quickly jumped）は飛ばす。動詞の前に別の語があれば無い。 */
const verbAfter = (tokens: readonly Token[], from: number, vocabulary: Vocabulary): Token | undefined => {
  const rest = tokens.slice(from);
  const verb = rest.find((token) => token.pos !== "ADV" && !isWord(token, vocabulary.relatives));
  return VERBAL.has(verb?.pos ?? "") ? verb : undefined;
};

const UNFINISHED = new Set(["Part", "Ger"]);

/** 主語として動詞が続く（many people keep）。名詞の前の飾り（the many people connected）や目的語（see many people on the trail）は人の一般論でない。 */
const isSubject = (tokens: readonly Token[], range: TokenRange, vocabulary: Vocabulary): boolean => {
  const verb = verbAfter(tokens, range.end, vocabulary);
  return verb !== undefined && verb.pos !== "PART" && !UNFINISHED.has(verb.features?.["VerbForm"] ?? "");
};

/** 主語として使った subject の組の語の数。品詞が無ければ位置を言えないので、すべて数える。 */
const subjectUses = (sentence: Sentence, entry: LexiconEntry, vocabulary: Vocabulary): number => {
  if (sentence.tokens === undefined || entry.tokens === undefined) return entryEnds(sentence, entry).length;
  const tokens = sentence.tokens;
  return entryRanges(sentence, entry).filter((range) => isSubject(tokens, range, vocabulary)).length;
};

/** 誰のことかが決まっている: すぐ後の語（everyone here）、過去形の動詞（nobody caught it、一度の出来事）、この文か前の文の集まり。 */
const isBounded = (sentence: Sentence, previous: Sentence | undefined, range: TokenRange, vocabulary: Vocabulary): boolean => {
  const tokens = sentence.tokens ?? [];
  if (isWord(tokens[range.end], vocabulary.rightAfter)) return true;
  if (isPastVerb(verbAfter(tokens, range.end, vocabulary), vocabulary)) return true;
  return namesGroup(sentence, vocabulary) || namesGroup(previous, vocabulary);
};

/** who の組の語の、誰のことかが決まっていない出現。品詞が無ければ位置を言えないので、すべて数える。 */
const openUses = (sentence: Sentence, previous: Sentence | undefined, entry: LexiconEntry, vocabulary: Vocabulary): number => {
  if (sentence.tokens === undefined || entry.tokens === undefined) return entryEnds(sentence, entry).length;
  return entryRanges(sentence, entry).filter((range) => !isBounded(sentence, previous, range, vocabulary)).length;
};

const repeated = (pattern: string, times: number): string[] => Array.from({ length: times }, () => pattern);

const usesIn = (sentence: Sentence, previous: Sentence | undefined, vocabulary: Vocabulary): string[] => [
  ...vocabulary.general.flatMap((entry) => repeated(entry.pattern, entryEnds(sentence, entry).length)),
  ...vocabulary.subject.flatMap((entry) => repeated(entry.pattern, subjectUses(sentence, entry, vocabulary))),
  ...vocabulary.who.flatMap((entry) => repeated(entry.pattern, openUses(sentence, previous, entry, vocabulary))),
];

/** 大きく括る言い方を使った文。weasel-word が言う文（most people agree）は、同じ文を二度言わないので数えない。 */
export const sweepingSentences = (doc: ProseDocument, lexicon: Lexicon): SweepingSentence[] => {
  const weasel = doc.lexicons["weasel-word"] ?? [];
  const vocabulary = vocabularyOf(lexicon);
  return doc.sentences
    .map((sentence, index) => ({ sentence, previous: doc.sentences[index - 1] }))
    .filter(({ sentence }) => sentence.embeddedLanguage === undefined && !weasel.some((entry) => entryIn(sentence, entry)))
    .map(({ sentence, previous }) => ({ sentence, phrases: usesIn(sentence, previous, vocabulary) }))
    .filter((found) => found.phrases.length > 0);
};

const findingOf = (found: SweepingSentence, values: Readonly<Record<string, number>>): Finding => ({
  rule: "",
  severity: "info",
  line: 0,
  column: 0,
  quote: found.sentence.text.trim(),
  values: { matched: found.phrases[0] ?? "", ...values, offset: found.sentence.span.start },
});

/** 大きく括る言い方（most people、nobody）の 1000 語あたりの数。二種類以上を三つ以上使い、上限を超えたら、使った文をすべて言う。 */
export const overGeneralClaim: Detector = (doc, options): Finding[] => {
  const found = sweepingSentences(doc, options.lexicon ?? []);
  const uses = found.flatMap((entry) => entry.phrases);
  const length = wordsOf(doc);
  if (uses.length < MIN_USES || new Set(uses).size < MIN_PHRASES || length < MIN_DOCUMENT_LENGTH[doc.lengthUnit]) return [];
  const density = Math.round((uses.length / length) * PER * TENTHS) / TENTHS;
  return density <= options.limit ? [] : found.map((entry) => findingOf(entry, { count: uses.length, density, limit: options.limit }));
};
