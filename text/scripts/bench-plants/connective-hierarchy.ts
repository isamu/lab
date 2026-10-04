// Seeded lone connectives for `yarn bench`: a Japanese sentence joining a one-level list with 並びに, added to the first
// prose paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const LONE = "申請書並びに添付書類を提出してください。";

const plantLone = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && isJapanese(line) && /。$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()}${LONE}`,
  );

export const MUTATIONS: readonly Mutation[] = [{ id: "connective-hierarchy-ja", rule: "connective-hierarchy", languages: ["ja"], plant: plantLone }];
