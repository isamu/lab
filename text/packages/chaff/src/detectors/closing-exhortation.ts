import type { Detector, Finding, Lexicon, LexiconEntry, Sentence } from "../plugin.ts";
import { closingSentences } from "../closing-paragraph.ts";
import { comparableText, comparableWords, entryCloses, entryIn, entryOpens } from "./lexicon-match.ts";

// 結びで読み手を励ます・請け合う文（ぜひ〜してみてください、きっと〜はず、You've got this）。語はどれも語彙表が持ち、
// ここは組み方だけを知る。語彙表の group:
//   なし          それだけで当たる言い回し（てみてほしい、you've got this）
//   lead:<name>   文の中の前の語（ぜひ、きっと）。同じ <name> の end が後ろにあれば当たる
//   open:<name>   文頭に限る前の語（Happy）
//   end:<name>    文の終わりの語（てみてください、はずだ、!）

type Pair = { readonly name: string; readonly leads: Lexicon; readonly opens: Lexicon; readonly ends: Lexicon };

const LEAD = "lead:";
const OPEN = "open:";
const END = "end:";

const withPrefix = (lexicon: Lexicon, prefix: string, name: string): Lexicon => lexicon.filter((entry) => entry.group === `${prefix}${name}`);

const pairNames = (lexicon: Lexicon): string[] => [
  ...new Set(lexicon.flatMap((entry) => (entry.group?.startsWith(END) === true ? [entry.group.slice(END.length)] : []))),
];

/** 語彙表を、それだけで当たる言い回しと、前後の語の組に分ける。 */
export const exhortationWords = (lexicon: Lexicon): { readonly phrases: Lexicon; readonly pairs: readonly Pair[] } => ({
  phrases: lexicon.filter((entry) => entry.group === undefined),
  pairs: pairNames(lexicon).map((name) => ({
    name,
    leads: withPrefix(lexicon, LEAD, name),
    opens: withPrefix(lexicon, OPEN, name),
    ends: withPrefix(lexicon, END, name),
  })),
});

/** 文が語で終わるか。終わりの記号の手前の語（はずだ。）でも、記号そのもの（Happy baking!）でもよい。 */
const closesWith = (sentence: Sentence, entry: LexiconEntry): boolean =>
  entryCloses(sentence, entry) || withoutClosingQuotes(comparableText(sentence)).endsWith(comparableWords(entry.pattern));

/** Quotes, closing brackets and spaces after the last mark ("Happy baking!"), which close the sentence without ending it. */
const CLOSING_QUOTES = new Set(" \t\n」』)）\"'”’");

const withoutClosingQuotes = (text: string): string => {
  const chars = [...text];
  return chars.slice(0, chars.findLastIndex((char) => !CLOSING_QUOTES.has(char)) + 1).join("");
};

/** 前の語が文の中に（open なら文頭に）あり、文が組の後ろの語で終わるか。当たった前の語を返す。 */
const pairIn = (sentence: Sentence, pair: Pair): LexiconEntry | undefined => {
  if (!pair.ends.some((entry) => closesWith(sentence, entry))) return undefined;
  return pair.opens.find((entry) => entryOpens(sentence, entry)) ?? pair.leads.find((entry) => entryIn(sentence, entry));
};

/** 文が励ましか請け合いなら、言う語。 */
export const exhortationIn = (sentence: Sentence, words: ReturnType<typeof exhortationWords>): string | undefined =>
  words.phrases.find((entry) => entryIn(sentence, entry))?.pattern ??
  words.pairs.map((pair) => pairIn(sentence, pair)).find((entry) => entry !== undefined)?.pattern;

/** 結び（最後の節の終わりの段落）で読み手を励ます・請け合う文の数。limit は指摘に要る数。 */
export const closingExhortation: Detector = (doc, options): Finding[] => {
  const words = exhortationWords(options.lexicon ?? []);
  const hits = closingSentences(doc.sections, doc.paragraphs).flatMap((sentence) => {
    const matched = exhortationIn(sentence, words);
    return matched === undefined ? [] : [{ sentence, matched }];
  });
  if (hits.length < options.limit) return [];
  return hits.map((hit) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.matched, count: hits.length, limit: options.limit, offset: hit.sentence.span.start },
  }));
};
