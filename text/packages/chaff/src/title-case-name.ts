// A name written as a run of capitalised words inside a sentence (the Interagency Group, the Twenty-Nine Palms Band of Mission
// Indians, Radical Uncertainty: Decision-Making Beyond the Numbers). Pure.

import type { Span } from "./plugin.ts";

const LATIN_WORD = /\p{Script=Latin}[\p{Script=Latin}\d'’]*(?:-[\p{Script=Latin}\d]+)*/gu;
/** A capitalised word, with small letters after its capital, its hyphenated parts too (Twenty-Nine, Co-working, Interagency). */
const CAPITALISED = /^\p{Lu}[\p{Ll}\d'’]*(?:-[\p{L}\d][\p{Ll}\d]*)*$/u;
const SPACE_ONLY = /^ $/u;
const MIN_NAME_WORDS = 2;

type Word = { readonly text: string; readonly start: number; readonly end: number };

const isCapitalised = (word: Word): boolean => CAPITALISED.test(word.text);

/** Whether `word` carries on the run that ended at `last`: one space between, and capitalised or a joiner (of, and). */
const continues = (text: string, last: Word | undefined, word: Word, joiners: ReadonlySet<string>): boolean =>
  last !== undefined && SPACE_ONLY.test(text.slice(last.end, word.start)) && (isCapitalised(word) || joiners.has(word.text));

/** A run without the joiners it ends on (the Office of): a name ends on a capitalised word. */
const trimmed = (run: readonly Word[]): Word[] => run.slice(0, run.findLastIndex(isCapitalised) + 1);

const runsOf = (text: string, words: readonly Word[], joiners: ReadonlySet<string>): Word[][] =>
  words.reduce<Word[][]>((runs, word) => {
    const current = runs.at(-1);
    if (current !== undefined && continues(text, current.at(-1), word, joiners)) return [...runs.slice(0, -1), [...current, word]];
    return isCapitalised(word) ? [...runs, [word]] : runs;
  }, []);

const isName = (run: readonly Word[]): boolean => run.filter(isCapitalised).length >= MIN_NAME_WORDS;

const spanOf = (run: readonly Word[]): Span | undefined => {
  const [head, last] = [run[0], run.at(-1)];
  return head === undefined || last === undefined ? undefined : { start: head.start, end: last.end };
};

/**
 * A capitalised run: the whole run (Co-working Space), and the part of it that is surely a name (quoted), if any. The first
 * word of the sentence is left out of the quoted part, since a sentence and a title capitalise their first word whatever it is.
 */
export type NameRun = { readonly name: Span; readonly quoted: Span | undefined };

/** The capitalised runs of two words or more in a sentence, joined by the language's small words (of, and): names. */
export const titleCaseNameRuns = (text: string, joiners: readonly string[]): NameRun[] => {
  const words = [...text.matchAll(LATIN_WORD)].map((match) => ({ text: match[0], start: match.index, end: match.index + match[0].length }));
  const first = words[0];
  return runsOf(text, words, new Set(joiners))
    .map(trimmed)
    .filter(isName)
    .flatMap((run) => {
      const name = spanOf(run);
      const named = trimmed(run[0] === first ? run.slice(1) : run);
      return name === undefined ? [] : [{ name, quoted: isName(named) ? spanOf(named) : undefined }];
    });
};

/** A bracketed title: capitalised words and small words between them, nothing else (Processor to Sub-Processor). */
const BRACKETED = /\(([^()]+)\)/gu;
const SMALL_WORD = /^\p{Ll}{1,3}$/u;

const isTitleWords = (words: readonly string[]): boolean =>
  words.filter((word) => CAPITALISED.test(word)).length >= MIN_NAME_WORDS && words.every((word) => CAPITALISED.test(word) || SMALL_WORD.test(word));

/**
 * Titles set in brackets after what they label (Module Three (Processor to Sub-Processor)): every word capitalised but the
 * small ones between (to, of). The words are the title's, taken from where it is defined, so the run counts as a quoted name.
 */
export const bracketedTitleRuns = (text: string): NameRun[] =>
  [...text.matchAll(BRACKETED)].flatMap((match) => {
    const inner = match[1] ?? "";
    const start = match.index + 1;
    const span = { start, end: start + inner.length };
    return isTitleWords(inner.split(" ")) ? [{ name: span, quoted: span }] : [];
  });
