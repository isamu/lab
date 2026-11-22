/** A part written k/n (2/3): the k-th of n, counted from 1. */
export type Part = { readonly index: number; readonly count: number };

const PART = /^([1-9]\d*)\/([1-9]\d*)$/u;

/** The part named by "k/n", or undefined for no part (every sample); a malformed or impossible part throws, so CI cannot run none. */
export const partOf = (written: string | undefined): Part | undefined => {
  if (written === undefined || written === "") return undefined;
  const found = PART.exec(written);
  const index = Number(found?.[1]);
  const count = Number(found?.[2]);
  if (found === null || index > count) throw new Error(`samples: CHAFF_SAMPLE_PART must be k/n with 1 <= k <= n, not "${written}"`);
  return { index, count };
};

/** The items of one part, dealt round-robin so each part takes both languages and a similar load; every item lands in exactly one part. */
export const inPart = <T>(items: readonly T[], part: Part | undefined): T[] =>
  part === undefined ? [...items] : items.filter((_, at) => at % part.count === part.index - 1);
