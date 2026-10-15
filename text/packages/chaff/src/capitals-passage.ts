// A word set in capitals because the passage around it is (a disclaimer, a heading or a running header in capitals): eGAIN in
// "eGAIN AND ITS SUPPLIERS MAKE NO WARRANTY" is the passage's capitals, not another spelling of eGain.

/** Words read on each side of the span, in its sentence and on its line. */
const NEIGHBOURS = 3;
/** Words, the span's own included, that make a passage rather than one word in capitals. */
const MIN_PASSAGE_WORDS = 3;
/** How far to look on each side (UTF-16 units): three words, however long, fit. */
const WINDOW = 200;
const WORD = /\p{Script=Latin}[\p{Script=Latin}\p{N}'’]*/gu;
const LOWER = /\p{Ll}/u;
/** The end of a sentence or a line: the passage does not run across it ("7. Warranty. THE SYSTEMS ARE …"). */
const STOP = /[.!?;:]\s|\n/gu;

/** A word in capitals after its first letter (WARRANTY, eGAIN, eGAIN'S). */
const isCapitalsWord = (word: string): boolean => !LOWER.test([...word].slice(1).join(""));

/** The Latin words of two letters or more: a one-letter word (a, I) says nothing about the passage. */
const wordsIn = (text: string): string[] => [...text.matchAll(WORD)].map((match) => match[0]).filter((word) => [...word].length >= 2);

const afterLastStop = (text: string): string => text.slice(Math.max(0, ...[...text.matchAll(STOP)].map((match) => match.index + match[0].length)));

const beforeFirstStop = (text: string): string => text.slice(0, [...text.matchAll(STOP)][0]?.index ?? text.length);

/** Whether the words of text[start, end) and up to three words on each side of it, in its sentence, are all in capitals, three or more of them. */
export const isInCapitalsPassage = (text: string, start: number, end: number): boolean => {
  const before = wordsIn(afterLastStop(text.slice(Math.max(0, start - WINDOW), start))).slice(-NEIGHBOURS);
  const after = wordsIn(beforeFirstStop(text.slice(end, end + WINDOW))).slice(0, NEIGHBOURS);
  const words = [...before, ...wordsIn(text.slice(start, end)), ...after];
  return words.length >= MIN_PASSAGE_WORDS && words.every(isCapitalsWord);
};
