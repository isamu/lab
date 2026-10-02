// Seeded keigo mistakes for `yarn bench`: a humble verb put on the reader's action. Pure and deterministic.
import { isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

type Swap = readonly [string, string];

const HUMBLE_FOR_READER: readonly Swap[] = [
  ["へ連絡してください", "へご連絡してください"],
  ["一緒に見せてください", "一緒に拝見してください"],
];

const swapFirst = (line: string): string | undefined => {
  const pair = HUMBLE_FOR_READER.find(([from]) => line.includes(from));
  return pair === undefined ? undefined : line.replace(pair[0], pair[1]);
};

/** 読み手に頼む文の動詞を、謙譲語にする。「連絡してください」を「ご連絡してください」に。 */
const humbleForReader = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && swapFirst(line) !== undefined,
    (line) => swapFirst(line),
  );

export const KEIGO_MUTATIONS: readonly Mutation[] = [{ id: "humble-for-reader", rule: "humble-for-others", languages: ["ja"], plant: humbleForReader }];
