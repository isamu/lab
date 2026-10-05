// Seeded open paragraphs for `yarn bench`: a Japanese paragraph that stops without 。, added after the first prose paragraph
// that ends with one. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const OPEN = "審査の結果は郵送でお知らせしました";

/** The planted paragraph is two lines below the line it follows. */
const PARAGRAPH_GAP = 2;

const plantOpen = (source: string): Plant | undefined => {
  const plant = rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && isJapanese(line) && /。$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()}\n\n${OPEN}`,
  );
  return plant === undefined ? undefined : { ...plant, line: plant.line + PARAGRAPH_GAP };
};

export const MUTATIONS: readonly Mutation[] = [{ id: "missing-final-period-ja", rule: "missing-final-period", languages: ["ja"], plant: plantOpen }];
