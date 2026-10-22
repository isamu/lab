import type { Lexicon, LexiconEntry, Sentence } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { comparableText, comparableWords, entryCloses, entryIn, entryOpens, entryRanges } from "./lexicon-match.ts";

/**
 * 対比の枠の語。frames は 1 つで枠になる語（not only、だけでなく）。
 * leads は打ち消し（it's not、単なる）で、turns（it's、but、ではなく）が後ろに来たときだけ枠になる。同じ文の後ろか、次の文の頭。
 * 打ち消しの頭に立つ返しの語（It's not ready. It's not tested. の 2 つ目の It's）は返しではなく、次の打ち消し。
 * 語の組（group）で返し方を絞る。across の打ち消し（don't、wasn't）は次の文の頭でしか返らず、その文に打ち消しがあれば返っていない。
 * across の返し（It、They）は次の文の頭でしか返しにならない。closing の打ち消し（はなく、）は、同じ文が closing の返し（です、だ）で閉じたときだけ枠。
 */
export type ContrastWords = { readonly frames: Lexicon; readonly leads: Lexicon; readonly turns: Lexicon };

const ACROSS = "across";
const CLOSING = "closing";

const lowered = (entry: LexiconEntry): string => comparableWords(entry.pattern);

type Range = { readonly start: number; readonly end: number };

/** 返しの語が、それより長い打ち消しの頭にあるか（It's not の It's）。同じ長さなら返しのまま（ではなく は打ち消しでも返しでもある）。 */
const opensLongerLead = (found: Range, leads: readonly Range[]): boolean => leads.some((lead) => lead.start === found.start && lead.end > found.end);

const answersAfter = (leadRange: Range, turns: readonly Range[], leads: readonly Range[]): boolean =>
  turns.some((found) => found.start >= leadRange.end && !opensLongerLead(found, leads));

/** 文字列の中で word が現れる範囲、左から順に。 */
const rangesOf = (text: string, word: string): Range[] =>
  [...text.matchAll(new RegExp(escapeRegExp(word), "gu"))].map((match) => ({ start: match.index, end: match.index + word.length }));

/** 組の無い語。同じ文の中でも、次の文の頭でも返す。 */
const plainOf = (lexicon: Lexicon): Lexicon => lexicon.filter((entry) => entry.group === undefined);
const groupOf = (lexicon: Lexicon, group: string): Lexicon => lexicon.filter((entry) => entry.group === group);

/** 品詞が無ければ位置を語で言えないので、空白をまとめた文字列の位置で比べる。 */
const textTurnAfter = (sentence: Sentence, lead: LexiconEntry, words: ContrastWords): boolean => {
  const text = comparableText(sentence);
  const leads = words.leads.flatMap((entry) => rangesOf(text, lowered(entry)));
  const turns = plainOf(words.turns).flatMap((entry) => rangesOf(text, lowered(entry)));
  return rangesOf(text, lowered(lead)).some((range) => answersAfter(range, turns, leads));
};

/** 打ち消しの語より後ろに、返しの語があるか。打ち消しそのもの（it's not の it's）と、次の打ち消しの頭は返しに数えない。 */
const turnAfter = (sentence: Sentence, lead: LexiconEntry, words: ContrastWords): boolean => {
  if (sentence.tokens === undefined || lead.tokens === undefined) return textTurnAfter(sentence, lead, words);
  const leads = words.leads.flatMap((entry) => entryRanges(sentence, entry));
  const turns = plainOf(words.turns).flatMap((entry) => entryRanges(sentence, entry));
  return entryRanges(sentence, lead).some((range) => answersAfter(range, turns, leads));
};

/** 次の文が返しの語で始まり、それ自体が打ち消しで始まっていないか。 */
const nextTurns = (next: Sentence | undefined, words: ContrastWords): boolean =>
  next !== undefined && plainOf(words.turns).some((turn) => entryOpens(next, turn)) && !words.leads.some((lead) => entryOpens(next, lead));

const LETTER = /\p{L}/u;

/** 品詞が無いと前方一致になるので、語の途中（It と Items）では文の頭の語と見ない。 */
const opensWithWord = (sentence: Sentence, entry: LexiconEntry): boolean => {
  if (!entryOpens(sentence, entry)) return false;
  if (sentence.tokens !== undefined && entry.tokens !== undefined) return true;
  return !LETTER.test(comparableText(sentence).charAt(comparableWords(entry.pattern).length));
};

/** 次の文が返しの語（across の It、They も）で始まり、どこにも打ち消しが無いか（It wasn't the plan. It was luck.）。 */
const nextAffirms = (next: Sentence | undefined, words: ContrastWords): boolean => {
  if (next === undefined) return false;
  const openers = [...plainOf(words.turns), ...groupOf(words.turns, ACROSS)];
  return openers.some((turn) => opensWithWord(next, turn)) && !words.leads.some((lead) => entryIn(next, lead));
};

const closesWithTurn = (sentence: Sentence, words: ContrastWords): boolean => groupOf(words.turns, CLOSING).some((turn) => entryCloses(sentence, turn));

const answeredBy = (lead: LexiconEntry, sentence: Sentence, next: Sentence | undefined, words: ContrastWords): boolean => {
  if (lead.group === ACROSS) return nextAffirms(next, words);
  if (lead.group === CLOSING) return closesWithTurn(sentence, words);
  return turnAfter(sentence, lead, words) || nextTurns(next, words);
};

const answered = (sentence: Sentence, next: Sentence | undefined, words: ContrastWords): boolean =>
  words.leads.some((lead) => entryIn(sentence, lead) && answeredBy(lead, sentence, next, words));

/**
 * 対比の枠で書いた文。「X ではなく Y」「It's not X. It's Y.」の形で、打ち消した側の文を返す。
 * 2 文にまたがる枠も 1 つと数える。返しの文は数えない。
 */
export const contrastSentences = (sentences: readonly Sentence[], words: ContrastWords): Sentence[] =>
  sentences.filter((sentence, index) => words.frames.some((frame) => entryIn(sentence, frame)) || answered(sentence, sentences[index + 1], words));
