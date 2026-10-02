import type { Detector, Finding, Sentence, Token } from "../plugin.ts";
import { proseText } from "../measure.ts";
import { quotedSpans } from "../quoted-span.ts";
import { bracketDepth, clauseCount, topicDistance } from "../sentence-load.ts";

const findingOf = (sentence: Sentence, count: number, limit: number): Finding => ({
  rule: "",
  severity: "info",
  line: 0,
  column: 0,
  quote: proseText(sentence),
  values: { count, limit, offset: sentence.span.start },
});

/** Each sentence whose measure is over the limit. A sentence the measure cannot read (undefined) is left alone. */
const overLimit =
  (measure: (sentence: Sentence) => number | undefined): Detector =>
  (doc, options): Finding[] =>
    doc.sentences.flatMap((sentence) => {
      const count = measure(sentence);
      return count === undefined || count <= options.limit ? [] : [findingOf(sentence, count, options.limit)];
    });

/** Which characters of the text are inside a quotation, marked once so each token is a lookup rather than a scan of every quote. */
const quotedMask = (text: string): Uint8Array => {
  const mask = new Uint8Array(text.length);
  quotedSpans(text).forEach((span) => mask.fill(1, span.start, span.end));
  return mask;
};

/** The sentence's tokens outside quotations in 「」『』: a quoted title or remark is one noun to the sentence, whatever it holds. */
const ownTokens = (sentence: Sentence): Token[] => {
  const mask = quotedMask(sentence.text);
  const inQuote = (token: Token): boolean => mask[token.span.start - sentence.span.start] === 1 && mask[token.span.end - 1 - sentence.span.start] === 1;
  return (sentence.tokens ?? []).filter((token) => !inQuote(token));
};

/** Brackets inside brackets: 「（注（a）参照）」. The depth is read from the text, so it works in every language. */
export const bracketNesting: Detector = overLimit((sentence) => bracketDepth(sentence.text));

/** Clauses chained in one sentence (調べて、まとめ、報告したが、返事がないので、…). Needs the language's tokens. */
export const clauseChain: Detector = overLimit((sentence) => (sentence.tokens === undefined ? undefined : clauseCount(ownTokens(sentence))));

/** The distance from the sentence's topic (〜は) to the end, where its predicate is. Needs the language's tokens. */
export const topicPredicateDistance: Detector = overLimit((sentence) => (sentence.tokens === undefined ? undefined : topicDistance(ownTokens(sentence))));
