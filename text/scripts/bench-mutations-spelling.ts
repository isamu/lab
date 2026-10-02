// Seeded English typo for `yarn bench`: a word with one letter dropped (attched), which no lexicon lists.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

/** 最初の英語の本文の段落の終わりに、一字抜けた語を含む文を足す。 */
const typoIn = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && !isJapanese(line) && /\.$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()} The full report is attched below.`,
  );

export const SPELLING_MUTATIONS: readonly Mutation[] = [{ id: "typo-en", rule: "unknown-word", languages: ["en"], plant: typoIn }];
