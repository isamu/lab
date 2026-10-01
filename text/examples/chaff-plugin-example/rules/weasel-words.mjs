// @ts-check
// Words that claim someone said something without saying who ("some say", と言われている). The words are data: the
// plugin ships them as the word list "weasel" in each language, and the detector gets the document's language's list.

/** @import { Detector, Lexicon, Sentence } from "chaffjs/api" */

/**
 * Where pattern starts in text, from the given place on, without overlap.
 * @param {string} text
 * @param {string} pattern
 * @param {number} from
 * @returns {number[]}
 */
const startsOf = (text, pattern, from = 0) => {
  const at = text.indexOf(pattern, from);
  return at === -1 ? [] : [at, ...startsOf(text, pattern, at + pattern.length)];
};

/**
 * Every place an entry's pattern is in the sentence, ignoring case.
 * @param {Sentence} sentence
 * @param {Lexicon} lexicon
 */
const entriesIn = (sentence, lexicon) => {
  const text = sentence.text.toLowerCase();
  return lexicon.flatMap((entry) => {
    const pattern = entry.pattern.toLowerCase();
    return startsOf(text, pattern).map((at) => ({ start: sentence.span.start + at, end: sentence.span.start + at + pattern.length }));
  });
};

/** @type {Detector} */
export const weaselWords = (doc, options) => doc.sentences.flatMap((sentence) => entriesIn(sentence, options.lexicon ?? []));

export const WEASEL_WORDS = {
  id: "weasel-words",
  level: "info",
  word_list: "weasel",
  name: { ja: "誰の言葉か分からない主張", en: "A claim with nobody behind it" },
  why: {
    ja: "「と言われている」は、誰が言ったのかを隠します。読み手は確かめられません",
    en: '"Some say" hides who said it, so the reader cannot check it',
  },
  how_to_fix: { ja: "言った人か出典を書きます", en: "Name who said it, or the source" },
  example: {
    before: { ja: "この方式は速いと言われている。", en: "Some say this approach is faster." },
    after: { ja: "この方式は 2 倍速い（社内の計測、2026 年 4 月）。", en: "This approach is twice as fast (our benchmark, April 2026)." },
  },
  detect: weaselWords,
};

/** The word list, by language. A string is an entry with only a pattern. */
export const WEASEL = {
  en: ["some say", "it is said", "many people believe", "experts agree", "arguably"],
  ja: ["と言われている", "と言われています", "一般的に", "多くの人が", "専門家によると"],
};
