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
const copulaBefore = (tokens: readonly Token[], end: number): boolean =>
  isCopula(tokens[tokens.findLastIndex((token, at) => at < end && !isCopulaTail(token))]);

const isComma = (token: Token | undefined): boolean => COMMA.has(token?.surface ?? "");

/** A noun of its own, not a nominaliser (こと, の, ところ) that only turns the clause before it into a noun. */
const isOwnNoun = (token: Token | undefined): boolean => NOMINAL.has(token?.pos ?? "") && token?.features?.["NounType"] !== "Dependent";

const isParticle = (token: Token, surface: string): boolean => token.surface === surface && token.pos === "ADP";

/**
 * A subject of its own after from: a new topic (法律はありませんが) anywhere, or a noun with が that the final predicate takes
 * (no comma after it: 動きが見られ始めている). A noun with が inside a condition (債務者が請求した場合、) is not one.
 */
const ownSubjectAfter = (tokens: readonly Token[], from: number, last: number): boolean => {
  const lastComma = tokens.findLastIndex((token, at) => at < last && isComma(token));
  return tokens.some(
    (token, at) => at > from && at < last && isOwnNoun(tokens[at - 1]) && (isParticle(token, "は") || (isParticle(token, "が") && at > lastComma)),
  );
};

/** The words of the clause after a comma at from, up to the next clause stopped by a comma, or the sentence's last word. */
const nextClause = (tokens: readonly Token[], from: number, last: number): readonly Token[] => {
  const stop = tokens.findIndex((token, at) => at > from && at < last && isComma(token) && PREDICATE.has(tokens[at - 1]?.pos ?? ""));
  return tokens.slice(from + 1, stop === -1 ? last : stop);
};

/** であって that narrows a class to a head noun after it (失業者であって、支援の必要がある者の…): the topic's predicate is still to come. */
const narrowsToHead = (tokens: readonly Token[], comma: number, last: number): boolean =>
  nextClause(tokens, comma, last).some((token) => token.pos === "NOUN" && RESTRICTED_HEADS.has(token.surface));

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

/**
 * A clause that may close the topic's predicate, when a new subject follows: a copula stopped by a comma after ない or ため
 * (〜ではなく、, 〜であるため、) and a continuing verb stopped by a comma (〜を続けており、).
 */
const closesIfNewSubject = (tokens: readonly Token[], at: number): boolean => {
  const token = tokens[at];
  if (!isComma(tokens[at + 1])) return false;
  if (token?.surface === "ため" || token?.lemma === "ない") return copulaBefore(tokens, at);
  return token?.pos === "VERB" && token.lemma === "おる" && token.features?.["Bound"] === "Yes";
};

/**
 * The index of the word that ends the topic's own clause, between the topic and the sentence's last word, or undefined when the
 * topic's predicate is the one the sentence ends on.
 */
export const topicClauseEnd = (tokens: readonly Token[], topic: number, last: number): number | undefined => {
  const end = tokens.findIndex(
    (_, at) => at > topic && at < last && (closesSurely(tokens, at, last) || (closesIfNewSubject(tokens, at) && ownSubjectAfter(tokens, at, last))),
  );
  return end === -1 ? undefined : end;
};
