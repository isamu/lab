import type { Token } from "./plugin.ts";

// How a Japanese word is used in its sentence, for orthographic-variant: uses a guide writes apart (見て下さい, 資料を下さい) are
// compared apart, and pieces that are not words of their own are left out.

/** A word, the two words before it and the two after it, in its sentence. */
export type InContext = {
  readonly token: Token;
  readonly previous: Token | undefined;
  readonly before: Token | undefined;
  readonly following?: readonly Token[];
};

/** A verb's て-form the tokenizer read as a conjunction (追って at the head of a sentence): a kanji stem and て or で. Connectives (そして, それで) are kana. */
const TE_FORM_CONJUNCTION = /^\p{Script=Han}.*[てで]$/u;

/** After a て-form (見てみる). The tokenizer reads the て as a joining word, or the whole て-form as a conjunction (追って / みる). */
const followsTeForm = (previous: Token | undefined): boolean =>
  (previous?.pos === "SCONJ" && (previous.surface === "て" || previous.surface === "で")) ||
  (previous?.pos === "CCONJ" && TE_FORM_CONJUNCTION.test(previous.surface));

/** は or も after a word ending in で, て or く: the ない after them negates (事実ではない, どれでもない, 高くはない); it is not 無い. */
const TOPIC_AFTER_LINK = new Set(["は", "も"]);
const LINK_END = /[でてく]$/u;
const NEGATION = new Set(["ない", "無い"]);

/** では and でも read as one word after a space (2 ではなく). */
const LINK_AND_TOPIC = new Set(["では", "でも"]);

const followsLinkAndTopic = (previous: Token | undefined, before: Token | undefined): boolean =>
  LINK_AND_TOPIC.has(previous?.surface ?? "") || (previous?.pos === "ADP" && TOPIC_AFTER_LINK.has(previous.surface) && LINK_END.test(before?.surface ?? ""));

const negatesAfterTopic = ({ token, previous, before }: InContext): boolean =>
  token.pos === "ADJ" && NEGATION.has(token.lemma ?? "") && followsLinkAndTopic(previous, before);

const isHelper = (word: InContext): boolean => word.token.features?.["Bound"] === "Yes" || followsTeForm(word.previous) || negatesAfterTopic(word);

export const isTouching = (left: Token | undefined, right: Token): boolean => left !== undefined && left.span.end === right.span.start;

export const HIRAGANA_ONLY = /^[ぁ-ゖー]+$/u;

/** A kana noun written onto a noun (全員ぶん): a suffix, which may not be the free noun of the same reading (文). */
const isKanaSuffix = ({ token, previous }: InContext): boolean =>
  token.pos === "NOUN" && previous?.pos === "NOUN" && isTouching(previous, token) && HIRAGANA_ONLY.test(token.surface);

/** The verb of an idiom (気をつける): the noun, the particle and the verb's dictionary form are in the idiom lexicon. */
const isIdiomVerb = ({ token, previous, before }: InContext, idioms: ReadonlySet<string>): boolean =>
  token.pos === "VERB" && previous?.pos === "ADP" && before !== undefined && idioms.has(`${before.surface}${previous.surface}${token.lemma ?? token.surface}`);

const TE = new Set(["て", "で"]);
const COMMA = new Set(["、", "，", ","]);

/**
 * A listed verb's て-form that opens its sentence and is followed by a comma (あわせて、…): a conjunction ("in addition"), which
 * many guides write in kana while the verb (日程を合わせる) keeps its kanji.
 */
const isTeFormConjunction = ({ token, previous, following }: InContext): boolean =>
  token.pos === "VERB" &&
  (previous === undefined || previous.pos === "PUNCT") &&
  TE.has(following?.[0]?.surface ?? "") &&
  COMMA.has(following?.[1]?.surface ?? "");

/**
 * A listed adverb that opens its sentence with a comma after it (さらに、), or right after a dash or a bracket (――もっとも): there it
 * joins the sentence to the one before. Opening a sentence alone (さらに高い成果を) it may still be the adverb.
 */
const isOpeningAdverb = ({ token, previous, before, following }: InContext): boolean =>
  token.pos === "ADV" &&
  ((previous === undefined && COMMA.has(following?.[0]?.surface ?? "")) || (previous?.pos === "PUNCT" && !COMMA.has(previous.surface) && before === undefined));

const isConjunctionUse = (word: InContext, conjunctions: ReadonlySet<string>): boolean =>
  conjunctions.has(word.token.lemma ?? "") && (isTeFormConjunction(word) || isOpeningAdverb(word));

/** と, or と and は or も (〜ともみられる): the quotative particle before a verb of judging. */
const QUOTATIVE = "と";
const QUOTATIVE_TOPIC = new Set(["は", "も"]);
const PASSIVE = new Set(["られる", "れる"]);

const followsQuotative = (previous: Token | undefined, before: Token | undefined): boolean =>
  previous?.pos === "ADP" && (previous.surface === QUOTATIVE || (QUOTATIVE_TOPIC.has(previous.surface) && before?.surface === QUOTATIVE));

/** The particles of the subject before an observing られる (増加がみられる, 発生はみられない); after を it is looking (映画を見られる). */
const OBSERVED_SUBJECT = new Set(["が", "は", "も"]);

const isObserved = (previous: Token | undefined, following: readonly Token[] | undefined): boolean =>
  previous?.pos === "ADP" && OBSERVED_SUBJECT.has(previous.surface) && PASSIVE.has(following?.[0]?.lemma ?? "");

/** A listed verb after the quotative と (〜とみる) or observing with られる (増加がみられる): judging what is seen, not looking. */
const isJudgingUse = ({ token, previous, before, following }: InContext, judging: ReadonlySet<string>): boolean =>
  token.pos === "VERB" && judging.has(token.lemma ?? "") && (followsQuotative(previous, before) || isObserved(previous, following));

/**
 * The lexicons that set a word's use apart: idioms (気をつける), conjunctions (あわせて、), judging (〜とみられる) and katakana
 * spellings that name a sense of their own (モノ for goods).
 */
export type Uses = {
  readonly idioms: ReadonlySet<string>;
  readonly conjunctions: ReadonlySet<string>;
  readonly judging: ReadonlySet<string>;
  readonly senses: ReadonlySet<string>;
};

/** A verb written straight onto the verb after it (出来上る, 書き込む): the head of a compound verb, which keeps the compound's spelling. */
const isCompoundVerbHead = ({ token, following }: InContext): boolean => {
  const next = following?.[0];
  return token.pos === "VERB" && next?.pos === "VERB" && isTouching(token, next);
};

/**
 * A helper verb or a dependent noun (見て下さい, その事) is written kana by many guides while the full word keeps its kanji (資料を下さい).
 * The two uses are compared apart, so a document that follows that convention is consistent. A suffix (業務用, 全員ぶん) is a third use:
 * it is not the dependent noun of the same reading (このように). The verb of an idiom (気をつける) is a fourth, and a
 * conjunction (あわせて、, さらに、) a fifth, a verb of judging (〜とみられる) a sixth, a katakana spelling with a sense of its own (モノ)
 * a seventh and the head of a compound verb (出来上る) an eighth.
 */
export const useOf = (word: InContext, { idioms, conjunctions, judging, senses }: Uses): string => {
  if (isIdiomVerb(word, idioms)) return "idiom";
  if (isConjunctionUse(word, conjunctions)) return "conjunction";
  if (isJudgingUse(word, judging)) return "judging";
  if (senses.has(word.token.surface)) return "sense";
  if (isCompoundVerbHead(word)) return "compound-verb";
  if (isKanaSuffix(word)) return "suffix";
  if (!isHelper(word)) return "free";
  return word.token.pos === "NOUN" && word.token.features?.["NounType"] !== "Dependent" ? "suffix" : "bound";
};

/** One katakana and then kana that is not katakana (スる): no verb stem is one katakana long, as サボる and ググる are two. */
const ONE_KATAKANA_HEAD = /^\p{Script=Katakana}(?!\p{Script=Katakana})/u;
const KATAKANA_END = /\p{Script=Katakana}$/u;

/** A piece the tokenizer cut out of a katakana run (ミスっ read as ミ and スる): not a word of its own. */
export const isCutFromKatakana = ({ token, previous }: InContext): boolean =>
  ONE_KATAKANA_HEAD.test(token.surface) && token.surface.length > 1 && isTouching(previous, token) && KATAKANA_END.test(previous?.surface ?? "");

/**
 * で read as the verb 出る right after a word with no particle between (JSON でない): the copula's で, which the tokenizer
 * misreads after a space or a name. 出る after a particle (結果がでない) or at the head of a sentence (でない音) is the verb.
 */
export const isCopulaReadAsVerb = ({ token, previous }: InContext): boolean =>
  token.pos === "VERB" && token.surface === "で" && previous !== undefined && previous.pos !== "ADP";

const ONE_HIRAGANA = /^[ぁ-ゖ]$/u;
const ONTO_PRONOUN = new Set(["PRON"]);
const ONTO_WORD = new Set(["NOUN", "ADJ"]);

/**
 * A kana verb written onto the word before it with no particle between: after a pronoun (私みたような) it is not a verb at all,
 * and one kana after a noun or adjective (誂ら|え, 引き易|え) is okurigana the tokenizer cut off. Neither is 見る or 得る.
 */
export const isWrittenOntoWord = ({ token, previous }: InContext): boolean =>
  token.pos === "VERB" &&
  HIRAGANA_ONLY.test(token.surface) &&
  isTouching(previous, token) &&
  (ONTO_PRONOUN.has(previous?.pos ?? "") || (ONTO_WORD.has(previous?.pos ?? "") && ONE_HIRAGANA.test(token.surface)));

/** A numeral (三 of 三十): a number, not a word, though its reading meets one (岡田さん). */
export const isNumeral = (token: Token): boolean => token.features?.["NumType"] === "Card";
