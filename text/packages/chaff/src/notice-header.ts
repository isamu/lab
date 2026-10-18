// An official notice's head (通達: 課資2－7 / 各国税局長 殿): a document number and an addressee with an honorific of
// office. Pure. The words come from the language's notice-header lexicon; a notice takes no greeting and no closing.
import type { Lexicon } from "./plugin.ts";

/** The words of a notice's head, by their group in the notice-header lexicon. */
export type NoticeWords = {
  /** What a document number starts with (課資2－7: 課). */
  readonly numberPrefixes: readonly string[];
  /** The word before and the word after the number of a document number written 〜第123号. */
  readonly numberHeads: readonly string[];
  readonly numberTails: readonly string[];
  /** The honorific an official notice puts after its addressee (各国税局長 殿). */
  readonly addressees: readonly string[];
};

const patternsIn = (lexicon: Lexicon, group: string): string[] => lexicon.filter((entry) => entry.group === group).map((entry) => entry.pattern);

export const noticeWordsOf = (lexicon: Lexicon): NoticeWords => ({
  numberPrefixes: patternsIn(lexicon, "number-prefix"),
  numberHeads: patternsIn(lexicon, "number-head"),
  numberTails: patternsIn(lexicon, "number-tail"),
  addressees: patternsIn(lexicon, "addressee"),
});

/** A document number is one short token of a line: 課資2－7, 総務省発第123号. */
const MAX_NUMBER_LENGTH = 20;
const DIGIT = /\p{Nd}/u;
const BLANK = /\s/u;
/** A document number is written in kanji, digits and dashes; hiragana makes the line words (課題は3つ). */
const HIRAGANA = /\p{Script=Hiragana}/u;

/** What follows the prefix: the office's kanji, then numbers joined by dashes (課資3-7: 資, 3-7). 課題3 has no dash. */
const PREFIXED_NUMBER_BODY = /^\p{Script=Han}*\p{Nd}+(?:[-－‐−–―]\p{Nd}+)+$/u;

const isNumberedForm = (line: string, words: NoticeWords): boolean =>
  words.numberPrefixes.some((prefix) => prefix !== "" && line.startsWith(prefix) && PREFIXED_NUMBER_BODY.test(line.slice(prefix.length))) ||
  words.numberTails.some(
    (tail) => tail !== "" && line.endsWith(tail) && words.numberHeads.some((head) => head !== "" && line.slice(0, -tail.length).includes(head)),
  );

const isNumberShaped = (line: string): boolean => line.length <= MAX_NUMBER_LENGTH && DIGIT.test(line) && !BLANK.test(line) && !HIRAGANA.test(line);

/** Whether a line is a document number alone: short, one run of characters with a digit and no hiragana, in one of the lexicon's forms. */
export const isDocumentNumber = (line: string, words: NoticeWords): boolean => {
  const trimmed = line.trim();
  return isNumberShaped(trimmed) && isNumberedForm(trimmed, words);
};

/** Whether a line is an addressee: a name, then the notice's honorific at the line's end (各国税局長 殿). */
export const isNoticeAddressee = (line: string, words: NoticeWords): boolean => {
  const trimmed = line.trim();
  return words.addressees.some((word) => trimmed.endsWith(word) && trimmed.length > word.length);
};

/** Whether head lines (before the first sentence) hold both a document number and an addressee of a notice. */
export const isNoticeHead = (headLines: readonly string[], words: NoticeWords): boolean =>
  headLines.some((line) => isDocumentNumber(line, words)) && headLines.some((line) => isNoticeAddressee(line, words));
