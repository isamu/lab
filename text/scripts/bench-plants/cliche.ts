// Seeded clichés for `yarn bench`: a sentence added to the first prose paragraph in each language, opening with
// "At the end of the day" in English and ending in 徹底解説します in Japanese. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const plantCliche = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && !isJapanese(line) && /\.$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()} At the end of the day, the plan stays.`,
  );

const plantJapaneseCliche = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && isJapanese(line) && /。$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()}この仕組みを徹底解説します。`,
  );

export const MUTATIONS: readonly Mutation[] = [
  { id: "cliche-end-of-day", rule: "cliche", languages: ["en"], plant: plantCliche },
  { id: "cliche-tettei-kaisetsu", rule: "cliche", languages: ["ja"], plant: plantJapaneseCliche },
];
