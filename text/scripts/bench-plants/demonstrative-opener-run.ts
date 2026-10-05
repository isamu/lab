// Seeded runs of sentences pointing back for `yarn bench`: three English sentences opening with This, It and That, added
// to the first English prose paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const plantRun = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && !isJapanese(line) && /\.$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()} This took a week. It needed two people. That cost was not planned.`,
  );

export const MUTATIONS: readonly Mutation[] = [{ id: "demonstrative-run-en", rule: "demonstrative-opener-run", languages: ["en"], plant: plantRun }];
