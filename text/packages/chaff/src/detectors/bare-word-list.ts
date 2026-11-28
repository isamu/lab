import type { Token } from "../plugin.ts";

/** An item longer than this, in characters, is a phrase of its own, not one word of a list (砂じん嵐 and 地ふぶき are short). */
const BARE_ITEM_MAX_CHARS = 6;
/** Fewer items than this in a row are a pair or a triple a clause may hold, not a list. */
const MIN_LIST_ITEMS = 4;

/** A particle or a conjunction ties the item to the clause around it (会議室で、新人に): a clause, not a bare word. */
const CLAUSAL: ReadonlySet<string> = new Set(["ADP", "SCONJ", "CCONJ", "PART"]);
const NOMINAL: ReadonlySet<string> = new Set(["NOUN", "PROPN", "NUM"]);

type Item = { readonly tokens: readonly Token[]; readonly commaAfter: number | undefined };

const isWord = (token: Token): boolean => token.pos !== "PUNCT" && token.surface.trim() !== "";

/** The tokens between the commas, each with the index of the comma that ends it; the last item ends with the sentence. */
const itemsOf = (tokens: readonly Token[], isComma: (token: Token) => boolean): Item[] => {
  const commas = tokens.flatMap((token, at) => (isComma(token) ? [at] : []));
  const starts = [0, ...commas.map((at) => at + 1)];
  return starts.map((start, index) => ({ tokens: tokens.slice(start, commas[index] ?? tokens.length), commaAfter: commas[index] }));
};

const wordsOf = (item: Item): readonly Token[] => item.tokens.filter(isWord);

/** One short word with no particle: 快晴, 晴れ, 地ふぶき. The parser may read a weather word as a verb (晴れ), so any part of speech goes. */
const isBare = (item: Item): boolean => {
  const words = wordsOf(item);
  const length = words.reduce((sum, token) => sum + token.surface.length, 0);
  return words.length > 0 && length <= BARE_ITEM_MAX_CHARS && !words.some((token) => CLAUSAL.has(token.pos));
};

/** A noun, maybe with a copula after it (雷です), and no verb (調査し). The parser may cut a noun into a noun and an auxiliary (みぞ・れ). */
const isNominal = (item: Item): boolean => {
  const words = wordsOf(item);
  return NOMINAL.has(words[0]?.pos ?? "") && !words.some((token) => token.pos === "VERB");
};

/** Consecutive bare items, split where an item is not bare. */
const bareRuns = (items: readonly Item[]): Item[][] =>
  items.reduce<Item[][]>(
    (runs, item) => {
      if (!isBare(item)) return [...runs, []];
      const last = runs.at(-1) ?? [];
      return [...runs.slice(0, -1), [...last, item]];
    },
    [[]],
  );

/** A run of bare words is a list when it is long enough and most of its words are nouns (調査し、分析し、検討し is a chain of clauses). */
const isList = (run: readonly Item[]): boolean => run.length >= MIN_LIST_ITEMS && run.filter(isNominal).length * 2 > run.length;

/**
 * The indices of the commas that only separate the words of a list written as bare short words (快晴、晴れ、薄曇り、曇り、…),
 * where the parser may not read every word as a noun.
 */
export const bareListCommas = (tokens: readonly Token[], isComma: (token: Token) => boolean): ReadonlySet<number> =>
  new Set(
    bareRuns(itemsOf(tokens, isComma))
      .filter(isList)
      .flatMap((run) => run.slice(0, -1).flatMap((item) => (item.commaAfter === undefined ? [] : [item.commaAfter]))),
  );
