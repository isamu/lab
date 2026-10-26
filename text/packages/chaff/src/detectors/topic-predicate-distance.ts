import type { Detector, ProseDocument, Sentence } from "../plugin.ts";
import { topicDistance } from "../sentence-load.ts";
import type { TopicClauseWords } from "../topic-clause.ts";
import { isIn } from "../lexicon-genres.ts";
import { overLimit, ownTokens } from "./sentence-load.ts";

const CLOSER_LEXICON = "topic-clause-close";
const ARTICLE_LEXICON = "statute-article-opener";

/**
 * Whether the sentence is an article of a statute quoted in another kind of document (第7条 … in a manual): the law's wording,
 * which the writer cannot change. In a statute or a contract (its genre, or a profile chaff reads it by) the articles are its own.
 */
const quotesArticle = (doc: ProseDocument, genre: string | undefined): ((sentence: Sentence) => boolean) => {
  if (doc.profile !== undefined || genre === undefined || isIn(genre, "legal")) return () => false;
  const openers = (doc.lexicons[ARTICLE_LEXICON] ?? []).map((entry) => new RegExp(entry.pattern, "u"));
  return (sentence) => openers.some((opener) => opener.test(sentence.text.trimStart()));
};

/** The distance from the sentence's topic (〜は) to the end, where its predicate is. Needs the language's tokens. */
export const topicPredicateDistance: Detector = (doc, options) => {
  const words: TopicClauseWords = { closers: (doc.lexicons[CLOSER_LEXICON] ?? []).map((entry) => entry.pattern) };
  const quoted = quotesArticle(doc, options.genre);
  return overLimit((sentence) => (sentence.tokens === undefined || quoted(sentence) ? undefined : topicDistance(ownTokens(sentence), words)))(doc, options);
};
