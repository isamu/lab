// How much one sentence asks the reader to hold at once: brackets inside brackets, clauses chained one after another, and how
// far the topic stands from the end where its predicate is. Pure: a sentence's text and tokens come in, numbers go out.
import type { Token } from "./plugin.ts";

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

/** A formula written in TeX ($d^k = -\nabla f(x^k)$): its brackets are the formula's, not the sentence's. */
const FORMULA = /\$\$[^$]*\$\$|\$[^$\n]*\$/gu;

/**
 * The deepest the brackets of a text nest: 「計画（案）」 is one, 「（注（a）を参照）」 two, plain text none. A closer with no
 * opener (the 1) of a list) is ignored, an opener never closed counts as open until the end, and formulas in $…$ are skipped.
 */
export const bracketDepth = (text: string): number => {
  // The closers still awaited, innermost last. Pushed and popped in place: copying it per character is quadratic on deep nesting.
  const awaited: string[] = [];
  return [...text.replace(FORMULA, " ")].reduce((deepest, char) => {
    if (awaited.at(-1) === char) awaited.pop();
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

/**
 * How far the sentence's first topic (会議は, これは) stands from the end of the sentence, where Japanese puts the predicate the
 * topic belongs to, in characters of the words between them (spaces, and a link's address the document hides, are not read).
 * undefined when the sentence has no topic. The distance is the reader's wait: everything between has to be held before the
 * topic is said to do anything.
 */
export const topicDistance = (tokens: readonly Token[]): number | undefined => {
  const topic = tokens.findIndex((token, at) => token.surface === "は" && token.pos === "ADP" && TOPIC_BEFORE.has(tokens[at - 1]?.pos ?? ""));
  const last = tokens.findLastIndex((token) => !TRAILING.has(token.pos));
  if (topic === -1 || last <= topic) return undefined;
  return tokens.slice(topic + 1, last).reduce((sum, token) => sum + [...token.surface.replace(/\s/gu, "")].length, 0);
};
