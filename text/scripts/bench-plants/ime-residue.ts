// Seeded input-method residue for `yarn bench`: a Japanese sentence holding one unconverted Latin letter (おもしrおい), added
// to the first prose paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const RESIDUE = "この資料はとてもおもしrおいです。";

const plantResidue = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && isJapanese(line) && /。$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()}${RESIDUE}`,
  );

export const MUTATIONS: readonly Mutation[] = [{ id: "ime-residue-ja", rule: "ime-residue", languages: ["ja"], plant: plantResidue }];
