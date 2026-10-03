// Seeded clichés for `yarn bench`: a sentence opening with "At the end of the day" added to the first English prose
// paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const plantCliche = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && !isJapanese(line) && /\.$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()} At the end of the day, the plan stays.`,
  );

export const MUTATIONS: readonly Mutation[] = [{ id: "cliche-end-of-day", rule: "cliche", languages: ["en"], plant: plantCliche }];
