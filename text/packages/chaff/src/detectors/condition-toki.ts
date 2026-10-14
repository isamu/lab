import type { Detector, Finding, Lexicon, Sentence, Token } from "../plugin.ts";
import { isWithinAny, quotedIn } from "../quoted-span.ts";

// A noun for a point in time written where the clause states a condition (認定を受けた時は → 認定を受けたときは). One word
// list gives the noun and its kana form, another the particles that make the clause a condition; this file knows parts of
// speech. Pure: the sentence and the word lists come in.

export type ConditionWords = { readonly nouns: ReadonlyMap<string, string>; readonly followers: ReadonlySet<string> };

export type ConditionSpelling = { readonly written: string; readonly preferred: string; readonly offset: number };

/** A predicate ends the clause before the noun (受けた時, 過ぎる時, 支払わない時, 必要な時); の, その and ある (事故の時, その時) do not. */
const PREDICATE_POS: ReadonlySet<string> = new Set(["VERB", "AUX", "ADJ"]);

const FOLLOWER_LIST = "condition-follower";

/** The nouns with their rewrite (時 → とき), and the particles that follow them in a condition (は, には, も). */
export const conditionWordsOf = (nouns: Lexicon | undefined, followers: Lexicon | undefined): ConditionWords => ({
  nouns: new Map((nouns ?? []).flatMap((entry): [string, string][] => (entry.rewrite === undefined ? [] : [[entry.pattern, entry.rewrite]]))),
  followers: new Set((followers ?? []).map((entry) => entry.pattern)),
});

/** The follower right after index: one particle (は, も) or two the tagger splits (に + は). */
const isFollowedByCondition = (tokens: readonly Token[], index: number, followers: ReadonlySet<string>): boolean => {
  const next = tokens[index + 1]?.surface ?? "";
  const pair = `${next}${tokens[index + 2]?.surface ?? ""}`;
  return followers.has(next) || followers.has(pair);
};

const isConditionNoun = (tokens: readonly Token[], index: number, words: ConditionWords): boolean => {
  const token = tokens[index];
  if (token === undefined || !words.nouns.has(token.surface)) return false;
  const previous = tokens[index - 1];
  return previous !== undefined && PREDICATE_POS.has(previous.pos) && isFollowedByCondition(tokens, index, words.followers);
};

/** Each noun in the sentence, outside 「」『』, that ends a predicate and is followed by は, には or も. */
export const conditionSpellingsIn = (sentence: Sentence, words: ConditionWords): ConditionSpelling[] => {
  const tokens = sentence.tokens ?? [];
  const quoted = quotedIn(sentence);
  return tokens.flatMap((token, index) =>
    isConditionNoun(tokens, index, words) && !isWithinAny(quoted, token.span)
      ? [{ written: token.surface, preferred: words.nouns.get(token.surface) ?? "", offset: token.span.start }]
      : [],
  );
};

export const conditionToki: Detector = (doc, options): Finding[] => {
  const words = conditionWordsOf(options.lexicon, doc.lexicons[FOLLOWER_LIST]);
  return doc.sentences.flatMap((sentence) =>
    conditionSpellingsIn(sentence, words).map((spelling) => ({
      rule: "",
      severity: "info",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { matched: spelling.written, preferred: spelling.preferred, offset: spelling.offset },
    })),
  );
};
