import type { Lexicon, LexiconEntry, Sentence } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { comparableText, comparableWords, entryIn, entryOpens, entryRanges } from "./lexicon-match.ts";

/**
 * 対比の枠の語。frames は 1 つで枠になる語（not only、だけでなく）。
 * leads は打ち消し（it's not、単なる）で、turns（it's、but、ではなく）が後ろに来たときだけ枠になる。同じ文の後ろか、次の文の頭。
 * 打ち消しの頭に立つ返しの語（It's not ready. It's not tested. の 2 つ目の It's）は返しではなく、次の打ち消し。
 */
export type ContrastWords = { readonly frames: Lexicon; readonly leads: Lexicon; readonly turns: Lexicon };

const lowered = (entry: LexiconEntry): string => comparableWords(entry.pattern);

type Range = { readonly start: number; readonly end: number };

/** 返しの語が、それより長い打ち消しの頭にあるか（It's not の It's）。同じ長さなら返しのまま（ではなく は打ち消しでも返しでもある）。 */
const opensLongerLead = (found: Range, leads: readonly Range[]): boolean => leads.some((lead) => lead.start === found.start && lead.end > found.end);

const answersAfter = (leadRange: Range, turns: readonly Range[], leads: readonly Range[]): boolean =>
  turns.some((found) => found.start >= leadRange.end && !opensLongerLead(found, leads));

/** 文字列の中で word が現れる範囲、左から順に。 */
const rangesOf = (text: string, word: string): Range[] =>
  [...text.matchAll(new RegExp(escapeRegExp(word), "gu"))].map((match) => ({ start: match.index, end: match.index + word.length }));

/** 品詞が無ければ位置を語で言えないので、空白をまとめた文字列の位置で比べる。 */
const textTurnAfter = (sentence: Sentence, lead: LexiconEntry, words: ContrastWords): boolean => {
  const text = comparableText(sentence);
  const leads = words.leads.flatMap((entry) => rangesOf(text, lowered(entry)));
  const turns = words.turns.flatMap((entry) => rangesOf(text, lowered(entry)));
  return rangesOf(text, lowered(lead)).some((range) => answersAfter(range, turns, leads));
};

/** 打ち消しの語より後ろに、返しの語があるか。打ち消しそのもの（it's not の it's）と、次の打ち消しの頭は返しに数えない。 */
const turnAfter = (sentence: Sentence, lead: LexiconEntry, words: ContrastWords): boolean => {
  if (sentence.tokens === undefined || lead.tokens === undefined) return textTurnAfter(sentence, lead, words);
  const leads = words.leads.flatMap((entry) => entryRanges(sentence, entry));
  const turns = words.turns.flatMap((entry) => entryRanges(sentence, entry));
  return entryRanges(sentence, lead).some((range) => answersAfter(range, turns, leads));
};

/** 次の文が返しの語で始まり、それ自体が打ち消しで始まっていないか。 */
const nextTurns = (next: Sentence | undefined, words: ContrastWords): boolean =>
  next !== undefined && words.turns.some((turn) => entryOpens(next, turn)) && !words.leads.some((lead) => entryOpens(next, lead));

const answered = (sentence: Sentence, next: Sentence | undefined, words: ContrastWords): boolean =>
  words.leads.some((lead) => entryIn(sentence, lead) && (turnAfter(sentence, lead, words) || nextTurns(next, words)));

/**
 * 対比の枠で書いた文。「X ではなく Y」「It's not X. It's Y.」の形で、打ち消した側の文を返す。
 * 2 文にまたがる枠も 1 つと数える。返しの文は数えない。
 */
export const contrastSentences = (sentences: readonly Sentence[], words: ContrastWords): Sentence[] =>
  sentences.filter((sentence, index) => words.frames.some((frame) => entryIn(sentence, frame)) || answered(sentence, sentences[index + 1], words));
