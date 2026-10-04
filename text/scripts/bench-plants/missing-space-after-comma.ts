// Seeded tight commas for `yarn bench`: an English sentence with no space after a comma between two words, added to the
// first prose paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const TIGHT = "Send the form to the office address,and keep a copy.";

const plantTight = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && !isJapanese(line) && /\.$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()} ${TIGHT}`,
  );

export const MUTATIONS: readonly Mutation[] = [{ id: "missing-space-after-comma-en", rule: "missing-space-after-comma", languages: ["en"], plant: plantTight }];
