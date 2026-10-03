// Seeded graded uncomparables for `yarn bench`: a sentence with "very unique" added to the first English prose paragraph.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const plantGraded = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && !isJapanese(line) && /\.$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()} The approach is very unique.`,
  );

export const MUTATIONS: readonly Mutation[] = [{ id: "uncomparable-very-unique", rule: "uncomparable-graded", languages: ["en"], plant: plantGraded }];
