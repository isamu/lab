import type { Token, TokenCondition } from "../plugin.ts";

// A team's morphology pattern: a run of tokens, each matching a condition on its part of speech, base form or surface.
// 「〜を行う」 is [{ pos: 名詞 }, { surface: を }, { base: 行う }]. Pure: tokens come from the language adapter.

/**
 * Parts of speech are Universal Dependencies tags (NOUN, VERB, ADP), the same for every language. A team may also write the
 * everyday name in Japanese or English; each maps to the tags the adapters give for it.
 */
const POS_NAMES: Readonly<Record<string, readonly string[]>> = {
  名詞: ["NOUN", "PROPN", "PRON", "NUM"],
  固有名詞: ["PROPN"],
  代名詞: ["PRON"],
  動詞: ["VERB"],
  形容詞: ["ADJ"],
  副詞: ["ADV"],
  助詞: ["ADP", "PART", "SCONJ", "CCONJ"],
  助動詞: ["AUX"],
  接続詞: ["CCONJ", "SCONJ"],
  連体詞: ["DET"],
  記号: ["PUNCT", "SYM"],
  noun: ["NOUN", "PROPN", "PRON"],
  verb: ["VERB"],
  adjective: ["ADJ"],
  adverb: ["ADV"],
  preposition: ["ADP"],
  determiner: ["DET"],
  pronoun: ["PRON"],
  conjunction: ["CCONJ", "SCONJ"],
  auxiliary: ["AUX"],
};

const UPOS: ReadonlySet<string> = new Set([
  "ADJ",
  "ADP",
  "ADV",
  "AUX",
  "CCONJ",
  "DET",
  "INTJ",
  "NOUN",
  "NUM",
  "PART",
  "PRON",
  "PROPN",
  "PUNCT",
  "SCONJ",
  "SYM",
  "VERB",
  "X",
]);

/** The tags a written part of speech stands for, or undefined when chaff does not know the name. */
export const posTags = (written: string): readonly string[] | undefined => {
  const upper = written.toUpperCase();
  if (UPOS.has(upper)) return [upper];
  return POS_NAMES[written] ?? POS_NAMES[written.toLowerCase()];
};

/** The names a team may write, for the message about an unknown one. */
export const POS_WRITTEN_NAMES: readonly string[] = [...UPOS, ...Object.keys(POS_NAMES)];

const sameWord = (left: string, right: string): boolean => left.toLowerCase() === right.toLowerCase();

const holds = (token: Token, condition: TokenCondition): boolean =>
  (condition.pos === undefined || condition.pos.includes(token.pos)) &&
  (condition.surface === undefined || sameWord(token.surface, condition.surface)) &&
  (condition.base === undefined || sameWord(token.lemma ?? token.surface, condition.base));

/** Every run of consecutive tokens where each holds its condition, as [first, last] token indexes. Runs do not overlap. */
export const tokenRuns = (tokens: readonly Token[], conditions: readonly TokenCondition[]): (readonly [number, number])[] => {
  if (conditions.length === 0) return [];
  return tokens.reduce<{ runs: (readonly [number, number])[]; next: number }>(
    (acc, _token, start) => {
      if (start < acc.next || start + conditions.length > tokens.length) return acc;
      const matches = conditions.every((condition, offset) => {
        const token = tokens[start + offset];
        return token !== undefined && holds(token, condition);
      });
      return matches ? { runs: [...acc.runs, [start, start + conditions.length - 1]], next: start + conditions.length } : acc;
    },
    { runs: [], next: 0 },
  ).runs;
};
