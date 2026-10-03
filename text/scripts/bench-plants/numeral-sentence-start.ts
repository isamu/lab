// Seeded sentence that opens with a numeral, for `yarn bench`: one sentence added to the first English paragraph.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const NUMERAL_OPENER = "20 people stayed for the vote.";

/** 最初の英語の段落の終わりに、数字で始まる文を足す。 */
const numeralOpenerIn = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isListItem(line) && !line.includes("`") && !isJapanese(line) && /\.$/u.test(line.trimEnd()),
    (line) => `${line.trimEnd()} ${NUMERAL_OPENER}`,
  );

export const MUTATIONS: readonly Mutation[] = [{ id: "numeral-sentence-start-en", rule: "numeral-sentence-start", languages: ["en"], plant: numeralOpenerIn }];
