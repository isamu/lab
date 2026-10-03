import type { Detector, Finding, Lexicon, LexiconEntry, Sentence } from "../plugin.ts";
import { entryIn } from "./lexicon-match.ts";

type Misuse = { readonly sentence: Sentence; readonly entry: LexiconEntry };

const misuseIn = (sentence: Sentence, lexicon: Lexicon): Misuse | undefined => {
  const entry = lexicon.find((candidate) => entryIn(sentence, candidate));
  return entry === undefined ? undefined : { sentence, entry };
};

const findingOf = (misuse: Misuse, limit: number): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: misuse.sentence.text.trim(),
  values: { matched: misuse.entry.pattern, correct: misuse.entry.rewrite ?? "", limit, offset: misuse.sentence.span.start },
});

/**
 * A phrase from a lexicon of established misuses, each entry carrying its correct form in `rewrite`. The message names
 * both, so the writer does not have to look the right form up. One finding per sentence, for its first listed misuse.
 */
export const misuseMatch: Detector = (doc, options): Finding[] => {
  const lexicon = options.lexicon ?? [];
  const misuses = doc.sentences.flatMap((sentence) => misuseIn(sentence, lexicon) ?? []);
  return misuses.length < options.limit ? [] : misuses.map((misuse) => findingOf(misuse, options.limit));
};
