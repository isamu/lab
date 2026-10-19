// A quoted term that quotes someone's wording rather than using the defined term again: the wording of a provision
// (憲法一九条にいう「良心の自由」, 第1項1号の「特定居住用宅地等」) or of a document (「謝罪」の文言, 「謝罪」、「陳謝」という文言).
// The cue words come from the language's word list quoted-wording-cue: group before ends right before the opening quote,
// group after starts right after the closing quote, past any further quotes listed with it. Pure.
import type { LexiconEntry } from "../plugin.ts";

const BEFORE = "before";
const AFTER = "after";

/** How far before the opening quote a cue is looked for. */
const LOOK_BACK = 12;
/** Further quotes listed after the first (「謝罪」、「陳謝の意を表します」という文言). */
const LISTED_QUOTES = /^(?:[、，・]?[「『][^」』\n]*[」』])*/u;

export type WordingCues = { readonly before: readonly string[]; readonly after: readonly string[] };

export const wordingCuesOf = (entries: readonly LexiconEntry[]): WordingCues => ({
  before: entries.filter((entry) => entry.group === BEFORE).map((entry) => entry.pattern),
  after: entries.filter((entry) => entry.group === AFTER).map((entry) => entry.pattern),
});

/** Whether the quote from opening (the opening mark) to closing (the closing mark) quotes wording, by the cues around it. */
export const quotesWording = (source: string, opening: number, closing: number, cues: WordingCues): boolean => {
  const before = source.slice(Math.max(0, opening - LOOK_BACK), opening);
  const rest = source.slice(closing + 1);
  const after = rest.slice(LISTED_QUOTES.exec(rest)?.[0].length ?? 0);
  return cues.before.some((cue) => cue !== "" && before.endsWith(cue)) || cues.after.some((cue) => cue !== "" && after.startsWith(cue));
};
