// Seeded mix of restrictive "that" and "which", for `yarn bench`: three "that" clauses and one "which" clause added to
// the first English paragraph. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const MIXED =
  "The job that builds the site runs nightly. The script that checks links runs hourly. The task that sends mail runs daily. The file which stores the keys is encrypted.";

/** 最初の英語の段落の終わりに、that の節三つと which の節一つを足す。 */
const mixedIn = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && !isJapanese(line) && /\.$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()} ${MIXED}`,
  );

export const MUTATIONS: readonly Mutation[] = [{ id: "which-that-consistency-en", rule: "which-that-consistency", languages: ["en"], plant: mixedIn }];
