import type { Lexicon, LexiconEntry, Sentence, Token } from "../plugin.ts";
import { entryEndsAt, entryRanges, type TokenRange } from "./lexicon-match.ts";
import { phraseEnd } from "./superlative-scope.ts";

/** 最上級の周りで、比べて言い切ってはいないことを示す語。どれも言語パッケージの語彙表が持つ。 */
export type Context = {
  /** 求める・選ぶ動詞（achieve・decide・求める）。position は最上級のどちら側に立つか。 */
  readonly goals: Lexicon;
  /** 述語の後ろで、どれが最もなのかを指す語（the one・the second）。 */
  readonly referents: Lexicon;
  /** 誰にとっての最もなのかを言う語（にとって）。 */
  readonly viewpoints: Lexicon;
};

/** 語彙表の語が最上級まで届く語の数。これより離れた動詞は、間に別の目的語や節がある。 */
const GOAL_REACH = 4;

/** 文の終わりの記号の後ろに付く、閉じの記号と強調の印（?」・?**）。 */
const CLOSING = new Set(" \t\n*_\"'”’」』)）]");
const QUESTION = new Set(["?", "？"]);

/** 問いの文（What takes the longest?・最も良い道は何か？）。問う文は何かが一番だと言い切っていない。 */
export const asked = (sentence: Sentence): boolean => {
  const chars = [...sentence.text];
  return QUESTION.has(chars[chars.findLastIndex((char) => !CLOSING.has(char))] ?? "");
};

/** 語彙表から、最上級の周りを読む語を集める。 */
export const contextOf = (lexicons: Readonly<Record<string, Lexicon>>): Context => ({
  goals: lexicons["superlative-goal"] ?? [],
  referents: lexicons["superlative-referent"] ?? [],
  viewpoints: lexicons["superlative-viewpoint"] ?? [],
});

const isPunct = (token: Token | undefined): boolean => token === undefined || token.pos === "PUNCT";

/** from 番目から to 番目の手前までに句読点が無いか。句読点を越えた語は別の節にかかる。 */
const sameClause = (tokens: readonly Token[], from: number, to: number): boolean => !tokens.slice(from, to).some((token) => isPunct(token));

/** 語彙の語が、最上級の手前 reach 語までのどこかで終わり、間に句読点が無いか。 */
const endsBefore = (tokens: readonly Token[], range: TokenRange, entry: LexiconEntry, reach: number): boolean => {
  const ends = Array.from({ length: Math.min(reach, range.start) + 1 }, (_unused, back) => range.start - back);
  return ends.some((end) => entryEndsAt(tokens, entry, end) && sameClause(tokens, end, range.start));
};

/** 語彙の語が最上級より後ろにあるか。 */
const after = (sentence: Sentence, range: TokenRange, entry: LexiconEntry): boolean => entryRanges(sentence, entry).some((found) => found.start >= range.end);

/**
 * 最上級が、求めるか選ぶものとして書かれているか（achieve the best results・decide the best way・最高の規律が求められる）。
 * 目指す先や選ぶ基準を言っていて、何かが一番だという主張ではない。英語の動詞は最上級の前に、日本語の述語は後ろに来る。
 */
export const sought = (sentence: Sentence, range: TokenRange, goals: Lexicon): boolean => {
  const tokens = sentence.tokens ?? [];
  return goals.some((entry) => (entry.position === "after" ? after(sentence, range, entry) : endsBefore(tokens, range, entry, GOAL_REACH)));
};

const isWord = (token: Token | undefined, words: Lexicon): boolean =>
  token !== undefined && words.some((entry) => entry.pattern.toLowerCase() === token.surface.toLowerCase());

const VERBAL = new Set(["VERB", "AUX"]);

/**
 * 最上級の名詞句が主語で、述語がどれかを指しているか（The best plan is the one you keep・The most important divergence is
 * the second）。どれが一番なのかを決める言い方で、一番だという主張ではない。
 */
export const pointsAtReferent = (tokens: readonly Token[], range: TokenRange, referents: Lexicon): boolean => {
  const at = phraseEnd(tokens, range.end);
  if (!VERBAL.has(tokens[at]?.pos ?? "")) return false;
  const next = tokens[at + 1]?.pos === "DET" ? at + 2 : at + 1;
  return isWord(tokens[next], referents);
};

/** 誰にとっての最もなのかが、同じ節の最上級より前にあるか（俺にとって今日は最高の日だ）。 */
export const viewpointBefore = (tokens: readonly Token[], range: TokenRange, viewpoints: Lexicon): boolean =>
  viewpoints.some((entry) => endsBefore(tokens, range, entry, range.start));
