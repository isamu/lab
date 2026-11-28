// A code block whose lead-in says it holds what a program shows ("So, on day 3, we'd expect to see:"): the block is plain
// output, which is in no language. Pure; the lead-in words come from the output-lead-in lexicon.

const LEAD_IN_END = /[:：]\s*$/u;
const LETTER = /\p{L}/u;

/** The last line with text before `offset`. */
const lineAbove = (source: string, offset: number): string =>
  source
    .slice(0, offset)
    .split("\n")
    .findLast((line) => line.trim() !== "") ?? "";

/** A Latin word stands whole (output, not outputs); 「表示され」 may sit inside a longer run. */
const holdsWord = (line: string, word: string): boolean => {
  const at = line.indexOf(word);
  if (at === -1) return false;
  if (!/^[a-z]/u.test(word)) return true;
  const whole = !LETTER.test(line.charAt(at - 1)) && !LETTER.test(line.charAt(at + word.length));
  return whole || holdsWord(line.slice(at + word.length), word);
};

/** Whether the line just above the block at `offset` ends in a colon and says the block is output. */
export const afterOutputLeadIn = (source: string, offset: number, words: readonly string[]): boolean => {
  const line = lineAbove(source, offset);
  const lower = line.toLowerCase();
  return LEAD_IN_END.test(line) && words.some((word) => word !== "" && holdsWord(lower, word.toLowerCase()));
};
