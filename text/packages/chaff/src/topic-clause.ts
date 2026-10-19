// Where a sentence's topic (〜は) gets its own predicate when that is not the end of the sentence: the topic is said to be
// something and the sentence goes on with another clause (この道行きは安易なものではありませんが、…). Pure: tokens in, an index out.
import type { Token } from "./plugin.ts";

const COMMA = new Set(["、", "，"]);
const NOMINAL = new Set(["NOUN", "PRON", "PROPN"]);

/**
 * The copula that says what the topic is: で (ものである; read as a particle in 事業ではなく) and です. な before a noun is not a
 * predicate.
 */
const isCopula = (token: Token | undefined): boolean =>
  token?.surface === "で" ? token.pos === "AUX" || token.pos === "ADP" : token?.pos === "AUX" && token.lemma === "です";

/** The words a copula is finished with before its conjunction: あり, ござい, ます, ませ, ん, the は of ではありません. */
const COPULA_TAIL = new Set(["ある", "ござる", "ます", "ん", "ぬ", "は"]);

const copulaBefore = (tokens: readonly Token[], end: number): boolean => {
  const at = tokens.slice(0, end).findLastIndex((token) => !COPULA_TAIL.has(token.lemma ?? token.surface) && !COPULA_TAIL.has(token.surface));
  return isCopula(tokens[at]);
};

/** A subject of its own in what follows: a noun with が or は (法律はありませんが, 動きが見られ). */
const ownSubjectAfter = (tokens: readonly Token[], from: number): boolean =>
  tokens.some((token, at) => at > from && (token.surface === "が" || token.surface === "は") && token.pos === "ADP" && NOMINAL.has(tokens[at - 1]?.pos ?? ""));

/**
 * A clause the topic's predicate closes for certain: a copula with が or て (〜ではありませんが, 〜でございますが, 〜であって),
 * or a quotation the sentence reports in the passive (〜だと言われているが), whose topic is inside the quotation.
 */
const closesSurely = (tokens: readonly Token[], at: number): boolean => {
  const token = tokens[at];
  if (token?.pos === "SCONJ" && (token.surface === "が" || token.surface === "て")) return copulaBefore(tokens, at);
  return token?.surface === "と" && token.pos === "ADP" && tokens[at + 1]?.pos === "VERB" && tokens[at + 2]?.features?.["Voice"] === "Pass";
};

/**
 * A clause that may close the topic's predicate, when a new subject follows: a copula stopped by a comma or ため (〜ではなく、,
 * 〜であるため、) and a continuing verb stopped by a comma (〜を続けており、).
 */
const closesIfNewSubject = (tokens: readonly Token[], at: number): boolean => {
  const token = tokens[at];
  if (!COMMA.has(tokens[at + 1]?.surface ?? "")) return false;
  if (token?.surface === "ため" || token?.lemma === "ない" || token?.lemma === "ある") return copulaBefore(tokens, at);
  return token?.pos === "VERB" && token.lemma === "おる" && token.features?.["Bound"] === "Yes";
};

/**
 * The index of the word that ends the topic's own clause, between the topic and the sentence's last word, or undefined when the
 * topic's predicate is the one the sentence ends on.
 */
export const topicClauseEnd = (tokens: readonly Token[], topic: number, last: number): number | undefined => {
  const end = tokens.findIndex(
    (_, at) => at > topic && at < last && (closesSurely(tokens, at) || (closesIfNewSubject(tokens, at) && ownSubjectAfter(tokens, at))),
  );
  return end === -1 ? undefined : end;
};
