// A capital run that a sentence names as a label on a screen: "your authorization is in SUBMIT TO APPROVER status", "press
// the SAVE AND CLOSE button". The run quotes the label as the screen shows it. Pure; the nouns come from the lexicon.

/** A word in lower case: the word right before the run, when the run sits inside a sentence rather than at its head. */
const LOWER_WORD = /^\p{Ll}[\p{L}'’]*$/u;

/** The word right after the run, in lower case. */
const WORD_AFTER = /^ (\p{Ll}+)(?!\p{L})/u;

/** Whether the run at start..end of `source` sits in a sentence and is followed by one of `nouns` ("status", "button"). */
export const namesScreenLabel = (source: string, start: number, end: number, nouns: ReadonlySet<string>): boolean => {
  const after = WORD_AFTER.exec(source.slice(end))?.[1];
  const before = source.slice(0, start);
  return after !== undefined && nouns.has(after) && before.endsWith(" ") && LOWER_WORD.test(before.slice(0, -1).split(" ").at(-1) ?? "");
};
