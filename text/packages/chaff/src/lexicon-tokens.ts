import type { LanguageAdapter, Lexicon, LexiconEntry } from "./plugin.ts";

/** adapter の語彙表は adapter ごとに一度だけ分ける。チームの語彙表は文書ごとに作られるので、この表に残らない。 */
const split = new WeakMap<LanguageAdapter, WeakMap<Lexicon, Lexicon>>();

const splitBy = (adapter: LanguageAdapter): WeakMap<Lexicon, Lexicon> => {
  const known = split.get(adapter) ?? new WeakMap<Lexicon, Lexicon>();
  split.set(adapter, known);
  return known;
};

const tokenized = (entry: LexiconEntry, adapter: LanguageAdapter): LexiconEntry => {
  const tokens = adapter.segment(entry.pattern).sentences.flatMap((sentence) => sentence.tokens ?? []);
  return tokens.length === 0 ? entry : { ...entry, tokens };
};

const withTokens = (lexicon: Lexicon, adapter: LanguageAdapter): Lexicon => {
  const cache = splitBy(adapter);
  const known = cache.get(lexicon);
  if (known !== undefined) return known;
  const made = lexicon.map((entry) => tokenized(entry, adapter));
  cache.set(lexicon, made);
  return made;
};

/** 語彙表の語を、文と同じ解析器で語に分けておく。語彙表の検査が原形で照らせるように。品詞を読んでいない文書には何もしない。 */
export const tokenizedLexicons = (lexicons: Readonly<Record<string, Lexicon>>, adapter: LanguageAdapter): Readonly<Record<string, Lexicon>> =>
  Object.fromEntries(Object.entries(lexicons).map(([name, lexicon]) => [name, withTokens(lexicon, adapter)]));
