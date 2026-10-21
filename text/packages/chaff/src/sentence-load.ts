// How much one sentence asks the reader to hold at once: brackets inside brackets, clauses chained one after another, and how
// far the topic stands from the end where its predicate is. Pure: a sentence's text and tokens come in, numbers go out.
import type { Token } from "./plugin.ts";
import { topicClauseEnd } from "./topic-clause.ts";

/**
 * Opening brackets and the mark that closes each. Quotation marks that open and close with the same character are left out, and
 * so are curly braces, which prose rarely uses and code and formulas use everywhere.
 */
const BRACKETS: Readonly<Record<string, string>> = {
  "(": ")",
  "（": "）",
  "[": "]",
  "［": "］",
  "「": "」",
  "『": "』",
  "【": "】",
  "〔": "〕",
  "〈": "〉",
  "《": "》",
  "“": "”",
};

/** A closer and the same closer in the other width: a numbering marker written (1） closes the bracket it opened. */
const OTHER_WIDTH: Readonly<Record<string, string>> = { ")": "）", "）": ")", "]": "］", "］": "]" };

/** A formula written in TeX ($d^k = -\nabla f(x^k)$): its brackets are the formula's, not the sentence's. */
const FORMULA = /\$\$[^$]*\$\$|\$[^$\n]*\$/gu;

/**
 * A doubled parenthesis around text with no parenthesis inside (((居住の用に供したとき等)), （（注））): one mark written with two
 * characters, as a directive sets an article's caption, not a bracket inside a bracket.
 */
const DOUBLED_PAREN = /\(\(([^()（）]*)\)\)|（（([^()（）]*)））/gu;

const singled = (text: string): string =>
  text.replace(DOUBLED_PAREN, (_whole: string, half?: string, full?: string) => (half === undefined ? `（${full ?? ""}）` : `(${half})`));

/**
 * The deepest the brackets of a text nest: 「計画（案）」 is one, 「（注（a）を参照）」 two, plain text none. A closer with no
 * opener (the 1) of a list) is ignored, an opener never closed counts as open until the end, a closer of the other width closes
 * its opener ((1） is one), a doubled parenthesis ((題)) is one, and formulas in $…$ are skipped.
 */
export const bracketDepth = (text: string): number => {
  // The closers still awaited, innermost last. Pushed and popped in place: copying it per character is quadratic on deep nesting.
  const awaited: string[] = [];
  return [...singled(text.replace(FORMULA, " "))].reduce((deepest, char) => {
    const innermost = awaited.at(-1);
    if (innermost !== undefined && (innermost === char || innermost === OTHER_WIDTH[char])) awaited.pop();
    else if (BRACKETS[char] !== undefined) awaited.push(BRACKETS[char]);
    return Math.max(deepest, awaited.length);
  }, 0);
};

const PREDICATE = new Set(["VERB", "ADJ", "AUX"]);
const COMMA = new Set(["、", "，"]);

/**
 * Whether the token ends a clause that the sentence then goes on from: a conjunctive particle (調べて, 報告したが, ないので), or
 * a verb or adjective stopped by a comma (内容をまとめ、). て or で before a helper verb (調べている, 読んでもらう) joins two verbs
 * into one predicate and does not end a clause.
 */
const endsClause = (token: Token, next: Token | undefined): boolean => {
  if (token.pos === "SCONJ") return next?.features?.["Bound"] !== "Yes";
  return PREDICATE.has(token.pos) && next !== undefined && COMMA.has(next.surface);
};

const TRAILING = new Set(["PUNCT", "SYM"]);

/**
 * The number of clauses the tokens chain: one more than the clause ends before the last word. A sentence of one predicate is
 * one, and a sentence that ends on a particle (返信して。) has not chained another clause by it.
 */
export const clauseCount = (tokens: readonly Token[]): number => {
  const last = tokens.findLastIndex((token) => !TRAILING.has(token.pos));
  return 1 + tokens.filter((token, at) => at < last && endsClause(token, tokens[at + 1])).length;
};

const TOPIC_BEFORE = new Set(["NOUN", "PRON", "PROPN"]);

const isTopicAt = (tokens: readonly Token[], at: number): boolean =>
  tokens[at]?.surface === "は" && tokens[at]?.pos === "ADP" && TOPIC_BEFORE.has(tokens[at - 1]?.pos ?? "");

const isAdverbial = (token: Token | undefined): boolean => token?.features?.["Adverbial"] === "Yes";

/**
 * A word that makes the adverbial noun after it a phrase of its own: a noun (翌連結会計年度以降), a prefix (大多数), a の phrase
 * (日本人の多くは), or a determiner before a noun of its own (その多くは; その日は and その時は stay settings).
 */
const narrows = (token: Token | undefined, head: Token | undefined): boolean =>
  TOPIC_BEFORE.has(token?.pos ?? "") ||
  token?.features?.["Bound"] === "Yes" ||
  (token?.surface === "の" && token.pos === "ADP") ||
  (token?.pos === "DET" && head?.features?.["NounType"] !== "Dependent");

/**
 * は on words that also stand as adverbs and nothing else (今夜は, 当日は, その日は, 午前中は): it sets when or how much the
 * sentence speaks of. A noun phrase ending in one (翌連結会計年度以降は) is a topic.
 */
const isSettingAt = (tokens: readonly Token[], at: number): boolean => {
  const before = tokens.slice(0, at).findLastIndex((token) => !isAdverbial(token));
  return before < at - 1 && !narrows(tokens[before], tokens[at - 1]);
};

/** The sentence's topic: the first は on a noun, past a setting (今夜は、…死ぬといふことは) when a topic of another kind follows it. -1 when none. */
const firstTopic = (tokens: readonly Token[]): number => {
  const first = tokens.findIndex((_, at) => isTopicAt(tokens, at));
  if (first === -1 || !isSettingAt(tokens, first)) return first;
  const after = tokens.findIndex((_, at) => at > first && isTopicAt(tokens, at) && !isSettingAt(tokens, at));
  return after === -1 ? first : after;
};

/**
 * How far the sentence's first topic (会議は, これは) stands from the end of the sentence, where Japanese puts the predicate the
 * topic belongs to, in characters of the words between them (spaces, and a link's address the document hides, are not read).
 * When the topic gets its own predicate in an earlier clause (topicClauseEnd), the distance is to that clause's end.
 * undefined when the sentence has no topic. The distance is the reader's wait: everything between has to be held before the
 * topic is said to do anything.
 */
export const topicDistance = (tokens: readonly Token[]): number | undefined => {
  const topic = firstTopic(tokens);
  const last = tokens.findLastIndex((token) => !TRAILING.has(token.pos));
  if (topic === -1 || last <= topic) return undefined;
  return tokens.slice(topic + 1, topicClauseEnd(tokens, topic, last) ?? last).reduce((sum, token) => sum + [...token.surface.replace(/\s/gu, "")].length, 0);
};
