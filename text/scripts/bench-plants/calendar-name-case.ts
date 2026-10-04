// Seeded lower-case calendar names for `yarn bench`: an English sentence naming a weekday in lower case, added to the first
// prose paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const LOWER_CASE = "The review is on monday.";

const plantLowerCase = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && !isJapanese(line) && /\.$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()} ${LOWER_CASE}`,
  );

export const MUTATIONS: readonly Mutation[] = [{ id: "calendar-name-lower-en", rule: "calendar-name-case", languages: ["en"], plant: plantLowerCase }];
