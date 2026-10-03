// Seeded "less" before a countable plural, for `yarn bench`: one sentence added to the first English paragraph.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const LESS_ERRORS = "The new build reports less errors than the old one.";

/** 最初の英語の段落の終わりに、数えられる複数に less を付けた文を足す。 */
const lessErrorsIn = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && !isJapanese(line) && /\.$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()} ${LESS_ERRORS}`,
  );

export const MUTATIONS: readonly Mutation[] = [{ id: "less-for-fewer-en", rule: "less-for-fewer", languages: ["en"], plant: lessErrorsIn }];
