import type { Sentence, Token } from "../plugin.ts";

// A refrain: sentences in a row that end with the very same words, the word before the predicate included
// (いい船でした。…いい船でした。, …隊員がいます。…隊員がいます。). A speaker repeats a whole closing phrase on purpose;
// it is one figure, not the same ending said again and again (必要です。重要です。, Aが必要です。Bも必要です。). Pure.

const TRAILING_POS: ReadonlySet<string> = new Set(["PUNCT", "SYM"]);
const TAIL_POS: ReadonlySet<string> = new Set(["AUX", "PART"]);
const CONTENT_POS: ReadonlySet<string> = new Set(["NOUN", "PROPN", "ADJ"]);

const isSpace = (token: Token): boolean => token.surface.trim() === "";

/**
 * A word that names a thing on its own: not a bound or dependent word (法 in 定額法, こと, の) and not a noun of an act (補助, 支援,
 * 被害). A report repeats an act on purpose of record (…経費の補助を行った。…経費の補助を行った。), and that is the monotone run.
 */
const isFree = (token: Token | undefined): token is Token =>
  token !== undefined && token.features?.["Bound"] !== "Yes" && token.features?.["NounType"] !== "Dependent" && token.features?.["VerbForm"] !== "Vnoun";

/** Where the content word before the predicate stands: right before it, or before one particle (隊員|が|います). */
const argumentAt = (tokens: readonly Token[], head: number): number => {
  const at = tokens[head - 1]?.pos === "ADP" ? head - 2 : head - 1;
  const token = tokens[at];
  return isFree(token) && CONTENT_POS.has(token.pos) ? at : -1;
};

/**
 * The closing words of a sentence from the content word before its predicate: いい船でした for …いい船でした。, 隊員がいます for
 * …隊員がいます。. A predicate after a て-form or a bound word (採用しております, こともできます, ないのです) has no such word.
 */
export const closingPhraseOf = (sentence: Sentence): string | undefined => {
  const tokens = (sentence.tokens ?? []).filter((token) => !isSpace(token));
  const last = tokens.findLastIndex((token) => !TRAILING_POS.has(token.pos));
  const head = tokens.slice(0, last + 1).findLastIndex((token) => !TAIL_POS.has(token.pos));
  if (head <= 0 || head === last || !isFree(tokens[head])) return undefined;
  const from = argumentAt(tokens, head);
  if (from < 0) return undefined;
  return tokens
    .slice(from, last + 1)
    .map((token) => token.surface)
    .join("");
};

/** The fewest sentences that make a refrain. Two alike (…の被害もあります。…の被害もあります。) is the same ending said twice. */
const REFRAIN_MIN = 3;

type Block = { readonly phrase: string | undefined; readonly size: number };

const blocksOf = (phrases: readonly (string | undefined)[]): Block[] =>
  phrases.reduce<Block[]>((blocks, phrase) => {
    const last = blocks.at(-1);
    return last !== undefined && phrase !== undefined && last.phrase === phrase
      ? [...blocks.slice(0, -1), { phrase, size: last.size + 1 }]
      : [...blocks, { phrase, size: 1 }];
  }, []);

/** How many beats a run of sentences holds: a refrain (REFRAIN_MIN sentences or more in a row with the same closing phrase) is one. */
export const beatsOf = (sentences: readonly Sentence[]): number =>
  blocksOf(sentences.map(closingPhraseOf)).reduce((beats, block) => beats + (block.size >= REFRAIN_MIN ? 1 : block.size), 0);
