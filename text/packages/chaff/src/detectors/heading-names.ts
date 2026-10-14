import { straightApostrophes } from "../orthography.ts";

const WORD = /[A-Za-z][A-Za-z'-]*/gu;
const POSSESSIVE = /'s$/u;
/** 番号が続く語（Example 4、Layer 1）は番号の札で、名前ではない。札の語は流儀によらず大文字で書く。 */
const NUMBER_FOLLOWS = /^\s+\d/u;
/** 引用符の中（"Wakayama's Food Ingredients and Food Culture"）は題名や人の言葉で、題の語は名前でなくても大文字になる。 */
const QUOTE_MARK = /[“”]/gu;

const outsideQuotes = (text: string): string =>
  text
    .replace(QUOTE_MARK, '"')
    .split('"')
    .filter((_, index) => index % 2 === 0)
    .join(" ");

const startsUpper = (word: string): boolean => /^[A-Z]/u.test(word);

const midSentenceNames = (sentence: string): string[] =>
  [...outsideQuotes(straightApostrophes(sentence)).matchAll(WORD)]
    .slice(1)
    .filter((match) => startsUpper(match[0]) && !NUMBER_FOLLOWS.test(match.input.slice(match.index + match[0].length)))
    .map((match) => match[0].replace(POSSESSIVE, ""));

/**
 * 文書が文の途中で大文字で書く語（NOAA、Flood Inundation Mapping、Alaska）。固有の名前なので、見出しに出ても
 * どちらの流儀でも大文字のまま。見出しの流儀の証拠に数えないよう、所有格の形（NOAA's）も添えて返す。
 * 文の頭の語は、名前でなくても大文字になるので数えない。
 */
export const namesWrittenMidSentence = (sentences: readonly string[]): ReadonlySet<string> =>
  new Set(sentences.flatMap(midSentenceNames).flatMap((name) => [name, `${name}'s`]));
