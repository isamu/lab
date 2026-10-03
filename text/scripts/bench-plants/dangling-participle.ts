// Seeded dangling participle, for `yarn bench`: one sentence added to the first English paragraph.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const DANGLING = "Having reviewed the figures, it is clear that the plan holds.";

/** 最初の英語の段落の終わりに、分詞の句の後ろの主語が it の文を足す。 */
const danglingIn = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && !isJapanese(line) && /\.$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()} ${DANGLING}`,
  );

export const MUTATIONS: readonly Mutation[] = [{ id: "dangling-participle-en", rule: "dangling-participle", languages: ["en"], plant: danglingIn }];
