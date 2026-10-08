// nado-closed-list: 等, など or etc. on a list a limit closes (自転車等に限ります, only A, B, etc.), read sentence by sentence
// (nado-closed-list.ts). The tokens are moved to the sentence's own offsets before they are read.
import { closedListWordsOf, openWordsOnClosedLists } from "../nado-closed-list.ts";
import type { Detector, Finding, Sentence, Token } from "../plugin.ts";

const sentenceTokens = (sentence: Sentence): Token[] =>
  (sentence.tokens ?? []).map((token) => ({
    ...token,
    span: { start: token.span.start - sentence.span.start, end: token.span.end - sentence.span.start },
  }));

export const nadoClosedList: Detector = (doc, options): Finding[] => {
  const words = closedListWordsOf(options.lexicon ?? []);
  if (words.open.length === 0) return [];
  return doc.sentences.flatMap((sentence) =>
    openWordsOnClosedLists(sentence.text, sentenceTokens(sentence), words).map((hit) => ({
      rule: "",
      severity: "info",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { open: hit.open, limit: hit.limit, offset: sentence.span.start + hit.offset },
    })),
  );
};
