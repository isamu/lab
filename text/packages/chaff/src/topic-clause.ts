// Where a sentence's topic (〜は) gets its own predicate when that is not the end of the sentence: the topic is said to be
// something and the sentence goes on with another clause (この道行きは安易なものではありませんが、…). Pure: tokens in, an index out.
import type { Token } from "./plugin.ts";

const COMMA = new Set(["、", "，"]);
const NOMINAL = new Set(["NOUN", "PRON", "PROPN"]);
const PREDICATE = new Set(["VERB", "AUX", "ADJ", "SCONJ"]);
/** The nouns a restrictive であって leads to: 失業者であって、支援の必要がある者. */
const RESTRICTED_HEADS = new Set(["者", "もの", "物", "方"]);
/** Verbs that report what others say or think (〜と言われている). とされる is a rule's wording, not a report. */
const REPORTING = new Set(["言う", "思う", "考える", "見る", "伝える"]);

/**
 * The copula that says what the topic is: で (ものである; read as a particle in 事業ではなく) and です. な before a noun is not a
 * predicate.
 */
const isCopula = (token: Token | undefined): boolean =>
  token?.surface === "で" ? token.pos === "AUX" || token.pos === "ADP" : token?.pos === "AUX" && token.lemma === "です";

/** The words a copula is finished with before its conjunction: あり, ござい, ます, ませ, ん, the は of ではありません. */
const COPULA_TAIL = new Set(["ある", "ござる", "ます", "ん", "ぬ", "は"]);

const isCopulaTail = (token: Token): boolean => COPULA_TAIL.has(token.lemma ?? token.surface) || COPULA_TAIL.has(token.surface);

/** Whether the words just before end are a copula and its tail (ではありません, でございます, である). */
/** The first word at or before at that is not a copula's tail. Walks back only over the tail, so each call is short. */
const beforeTail = (tokens: readonly Token[], at: number): number => {
  const token = tokens[at];
  return token !== undefined && isCopulaTail(token) ? beforeTail(tokens, at - 1) : at;
};

const copulaBefore = (tokens: readonly Token[], end: number): boolean => isCopula(tokens[beforeTail(tokens, end - 1)]);

const isComma = (token: Token | undefined): boolean => COMMA.has(token?.surface ?? "");

/** A noun of its own, not a nominaliser (こと, の, ところ) that only turns the clause before it into a noun. */
const isOwnNoun = (token: Token | undefined): boolean => NOMINAL.has(token?.pos ?? "") && token?.features?.["NounType"] !== "Dependent";

const isParticle = (token: Token, surface: string): boolean => token.surface === surface && token.pos === "ADP";

/** A word that stands as a noun only after の: ほとんど and 多く in これらの処理のほとんどは are a part of what the の phrase names. */
const isNarrowedPart = (tokens: readonly Token[], at: number): boolean =>
  (tokens[at]?.pos === "ADV" || tokens[at]?.features?.["Adverbial"] === "Yes") && tokens[at - 1]?.surface === "の" && tokens[at - 1]?.pos === "ADP";

/** The word before at heads a subject of its own: a noun (法律は), or a part a の phrase narrows (処理のほとんどは). */
const headsSubject = (tokens: readonly Token[], at: number): boolean => isOwnNoun(tokens[at - 1]) || isNarrowedPart(tokens, at - 1);

/** A subject of its own at at: は on its head anywhere, or が on its head when lastComma is before it (-1 to take every が). */
const isOwnSubjectAt = (tokens: readonly Token[], at: number, lastComma: number): boolean => {
  const token = tokens[at];
  return token !== undefined && headsSubject(tokens, at) && (isParticle(token, "は") || (isParticle(token, "が") && at > lastComma));
};

/**
 * The last place a subject of its own stands before the sentence's last word: a new topic (法律はありませんが) anywhere, or a
 * noun with が that the final predicate takes (no comma after it: 動きが見られ始めている). A noun with が inside a condition
 * (債務者が請求した場合、) is not one. -1 when there is none. A clause has a subject of its own after it when this is past it.
 */
const lastOwnSubject = (tokens: readonly Token[], last: number): number => {
  const lastComma = tokens.findLastIndex((token, at) => at < last && isComma(token));
  return tokens.findLastIndex((_, at) => at < last && isOwnSubjectAt(tokens, at, lastComma));
};

/** The words of the clause after a comma at from, up to the next clause stopped by a comma, or the sentence's last word. */
const nextClause = (tokens: readonly Token[], from: number, last: number): readonly Token[] => {
  const stop = tokens.findIndex((token, at) => at > from && at < last && isComma(token) && PREDICATE.has(tokens[at - 1]?.pos ?? ""));
  return tokens.slice(from + 1, stop === -1 ? last : stop);
};

/** であって that narrows a class to a head noun after it (失業者であって、支援の必要がある者の…): the topic's predicate is still to come. */
const narrowsToHead = (tokens: readonly Token[], comma: number, last: number): boolean =>
  nextClause(tokens, comma, last).some((token, at, clause) => token.pos === "NOUN" && RESTRICTED_HEADS.has(token.surface) && clause[at + 1]?.surface !== "は");

/** A copula with が or て and a comma (〜ではありませんが、, 〜でございますが、, 〜であって、 that does not narrow to a head noun). */
const closesCopula = (tokens: readonly Token[], at: number, last: number): boolean => {
  const token = tokens[at];
  if (token?.pos !== "SCONJ" || (token.surface !== "が" && token.surface !== "て")) return false;
  if (!isComma(tokens[at + 1]) || !copulaBefore(tokens, at)) return false;
  return token.surface === "が" || !narrowsToHead(tokens, at + 1, last);
};

/** A quotation the sentence reports in the passive (〜だと言われているが), whose topic is inside the quotation. */
const closesReport = (tokens: readonly Token[], at: number): boolean => {
  const token = tokens[at];
  return token?.surface === "と" && token.pos === "ADP" && REPORTING.has(tokens[at + 1]?.lemma ?? "") && tokens[at + 2]?.features?.["Voice"] === "Pass";
};

/** A clause the topic's predicate closes for certain. */
const closesSurely = (tokens: readonly Token[], at: number, last: number): boolean => closesCopula(tokens, at, last) || closesReport(tokens, at);

/** 〜にあるところ、 / 〜したところ、: a clause the nominaliser ところ closes after a predicate. */
const closesWithTokoro = (tokens: readonly Token[], at: number): boolean =>
  tokens[at]?.surface === "ところ" && tokens[at]?.features?.["NounType"] === "Dependent" && PREDICATE.has(tokens[at - 1]?.pos ?? "");

/** 〜であるならば、: a copula's conditional. */
const closesWithCondition = (tokens: readonly Token[], at: number): boolean =>
  tokens[at]?.surface === "ば" && tokens[at]?.pos === "SCONJ" && tokens[at - 1]?.surface === "なら" && tokens[at - 1]?.lemma === "だ";

/** Whether a new topic of its own (ゴーシュは) stands after at, before the sentence's last word. */
const newTopicAfter = (tokens: readonly Token[], at: number, last: number): boolean =>
  tokens.some((token, index) => index > at && index < last && isParticle(token, "は") && isOwnNoun(tokens[index - 1]));

/**
 * それは…水車小屋で、ゴーシュは…: a noun and the copula's continuing で that end the topic's first clause, with no comma between
 * them, and a new topic after. Past a comma (お梶は、火のような瞳で、 / 〜ましたが、…相手に無断で、) a noun with で is more often a
 * manner or a means, and so it is before a mere が (本件を電子メールで、相手方が指定した担当者に説明する).
 */
const closesFirstClauseWithNoun = (tokens: readonly Token[], topic: number, at: number, last: number): boolean =>
  tokens[at]?.surface === "で" &&
  isCopula(tokens[at]) &&
  isOwnNoun(tokens[at - 1]) &&
  isComma(tokens[at + 1]) &&
  !tokens.slice(topic + 1, at).some(isComma) &&
  newTopicAfter(tokens, at + 1, last);

/**
 * A clause that may close the topic's predicate, when a new subject follows, each stopped by a comma: a copula after ない or
 * ため (〜ではなく、, 〜であるため、), a copula's condition (〜であるならば、), ところ (〜にあるところ、), and a continuing verb
 * (〜を続けており、).
 */
const closesIfNewSubject = (tokens: readonly Token[], at: number): boolean => {
  const token = tokens[at];
  if (!isComma(tokens[at + 1])) return false;
  if (token?.surface === "ため" || token?.lemma === "ない") return copulaBefore(tokens, at);
  if (closesWithTokoro(tokens, at) || closesWithCondition(tokens, at)) return true;
  return token?.pos === "VERB" && token.lemma === "おる" && token.features?.["Bound"] === "Yes";
};

/** The words a document's language gives for the shapes below (lang-ja's lexicons). Without them, only the shapes that need none. */
export type TopicClauseWords = {
  /** Words that end a clause right after its predicate (ことから, つつ, としても): the topic-clause-close lexicon. */
  readonly closers: readonly string[];
};

const NO_WORDS: TopicClauseWords = { closers: [] };

/** The first of the words that spell text when they end at at (こと + から for ことから), or -1 when no run of words does. */
const wordsStart = (tokens: readonly Token[], at: number, text: string, spelled = ""): number => {
  const token = tokens[at];
  if (token === undefined) return -1;
  const joined = token.surface + spelled;
  if (joined === text) return at;
  return joined.length < text.length && text.endsWith(joined) ? wordsStart(tokens, at - 1, text, joined) : -1;
};

/** Whether another subject (が or は on a noun, or on a clause made a noun: 行うことは) stands between from and to. */
const subjectBetween = (tokens: readonly Token[], from: number, to: number): boolean =>
  tokens.some(
    (token, at) =>
      at > from && at < to && (isParticle(token, "は") || isParticle(token, "が")) && (NOMINAL.has(tokens[at - 1]?.pos ?? "") || headsSubject(tokens, at)),
  );

/**
 * 学校は地域の核となることから、…: a closer after a predicate, then a comma, with no subject of its own
 * between the topic and it. That predicate is the topic's; what follows is said of something else, or by the writer. A topic set
 * off by a comma (AISIは、…連携しつつ、…行っていく) usually runs to the end, so then only a copula's closer counts (〜であることから、).
 */
const closesAfterPredicate = (tokens: readonly Token[], topic: number, at: number, words: TopicClauseWords): boolean => {
  if (!isComma(tokens[at + 1])) return false;
  return words.closers.some((connective) => {
    const start = wordsStart(tokens, at, connective);
    if (start <= topic + 1 || !PREDICATE.has(tokens[start - 1]?.pos ?? "") || subjectBetween(tokens, topic, start)) return false;
    return copulaBefore(tokens, start) || !tokens.slice(topic + 1, start).some(isComma);
  });
};

/** A mark that opens with a circled number (③): an item of a list the source ran into one line. */
const CIRCLED = /^[①-⒇❶-❿]/u;

const isBlank = (token: Token): boolean => token.surface.trim() === "";

/** 〜を向上させる ③ 次の項目: an item mark right after a predicate (spaces between are not read) ends the item before it. */
const closesWithItemMark = (tokens: readonly Token[], at: number): boolean => {
  if (!PREDICATE.has(tokens[at]?.pos ?? "")) return false;
  const next = tokens.findIndex((token, index) => index > at && !isBlank(token));
  return next !== -1 && CIRCLED.test(tokens[next]?.surface ?? "");
};

/**
 * The index of the word that ends the topic's own clause, between the topic and the sentence's last word, or undefined when the
 * topic's predicate is the one the sentence ends on.
 */
export const topicClauseEnd = (tokens: readonly Token[], topic: number, last: number, words: TopicClauseWords = NO_WORDS): number | undefined => {
  const subject = lastOwnSubject(tokens, last);
  const closes = (at: number): boolean =>
    closesSurely(tokens, at, last) ||
    (closesIfNewSubject(tokens, at) && subject > at) ||
    closesFirstClauseWithNoun(tokens, topic, at, last) ||
    closesAfterPredicate(tokens, topic, at, words) ||
    closesWithItemMark(tokens, at);
  const end = tokens.findIndex((_, at) => at > topic && at < last && closes(at));
  return end === -1 ? undefined : end;
};
