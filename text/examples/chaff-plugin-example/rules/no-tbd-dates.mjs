// @ts-check
// A date left undecided: "TBD" or 未定 in a sentence that talks about a date. A reader plans around a date, so one
// that is not there should say who decides it and by when.

/** @import { Detector, Sentence } from "chaffjs/api" */

/** The words that leave a date open, and the words that show the sentence is about a date, by language. */
const WORDS = {
  en: { undecided: /\b(?:TBD|TBC|to be decided|to be confirmed)\b/giu, about: /\b(?:date|deadline|launch|release|due)\b/iu },
  ja: { undecided: /未定|調整中/gu, about: /日|期限|締切|締め切り|公開|発売|リリース/u },
};

/**
 * @param {Sentence} sentence
 * @param {{ undecided: RegExp, about: RegExp }} words
 */
const undecidedIn = (sentence, words) =>
  words.about.test(sentence.text)
    ? [...sentence.text.matchAll(words.undecided)].map((match) => ({
        start: sentence.span.start + match.index,
        end: sentence.span.start + match.index + match[0].length,
      }))
    : [];

/** @type {Detector} */
export const noTbdDates = (doc) => {
  const words = doc.language === "ja" ? WORDS.ja : WORDS.en;
  return doc.sentences.flatMap((sentence) => undecidedIn(sentence, words));
};

export const NO_TBD_DATES = {
  id: "no-tbd-dates",
  level: "warning",
  name: { ja: "未定のままの日付", en: "A date left undecided" },
  why: {
    ja: "読み手は日付をもとに予定を立てます。決まっていない日付は、誰がいつまでに決めるかを書かないと、読み手が動けません",
    en: "A reader plans around a date. One that is not decided leaves them stuck unless it says who decides it, and by when",
  },
  how_to_fix: { ja: "日付を書くか、決める人と期限を書きます", en: "Write the date, or who decides it and by when" },
  example: {
    before: { ja: "公開日は未定です。", en: "The launch date is TBD." },
    after: { ja: "公開日は 10 月 1 日です（佐藤が 9 月 20 日までに決めます）。", en: "The launch date is 1 October; Sato decides by 20 September." },
  },
  detect: noTbdDates,
};
