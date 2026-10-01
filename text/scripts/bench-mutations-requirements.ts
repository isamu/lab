// Seeded mistakes of requirements wording for `yarn bench`: a measurable requirement loosened to "as fast as possible".
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

type Swap = readonly [string, string];

// --- requirement-smell ---

/** A requirement with a number, and the same requirement with a loophole in place of the number. */
const LOOSENED: readonly Swap[] = [
  ["三秒以内に表示されること", "可能な限り速く表示されること"],
  ["appears within three seconds", "must appear as fast as possible"],
];

/** 数で決めた要求の一つを「可能な限り」にゆるめる。 */
export const loosenRequirement = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && LOOSENED.some(([from]) => line.includes(from)),
    (line) => {
      const pair = LOOSENED.find(([from]) => line.includes(from));
      return pair === undefined ? undefined : line.replace(pair[0], pair[1]);
    },
  );

export const REQUIREMENT_MUTATIONS: readonly Mutation[] = [
  { id: "requirement-loosened", rule: "requirement-smell", languages: ["ja", "en"], plant: loosenRequirement },
];
