// Seeded graded uncomparables for `yarn bench`: a sentence added to the first prose paragraph in each language, with
// "very unique" in English and より最適な in Japanese. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const plantGraded = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && !isJapanese(line) && /\.$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()} The approach is very unique.`,
  );

const plantJapaneseGraded = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && isJapanese(line) && /。$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()}より最適な方法を選びました。`,
  );

export const MUTATIONS: readonly Mutation[] = [
  { id: "uncomparable-very-unique", rule: "uncomparable-graded", languages: ["en"], plant: plantGraded },
  { id: "uncomparable-yori-saiteki", rule: "uncomparable-graded", languages: ["ja"], plant: plantJapaneseGraded },
];
