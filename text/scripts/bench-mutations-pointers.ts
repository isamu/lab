// Seeded mistakes of internal pointers for `yarn bench`: a numbered figure or table referred to by where it is.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { linesOf, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

// --- vague-figure-reference ---

const CAPTION = /^(図|表|Figure |Table )\d+[\s:：]/u;
const REFERENCE = /(図|表|Figure |Table )\d+/u;
const BY_PLACE: Readonly<Record<string, string>> = { 図: "上記の図", 表: "上記の表", "Figure ": "the figure above", "Table ": "the table above" };

/** 番号を付けた図や表を指す本文の最初の参照を、置き場所で指す言い方（上記の表、the table above）に書き換える。 */
export const pointByPlace = (source: string): Plant | undefined => {
  if (!linesOf(source).some((line) => CAPTION.test(line))) return undefined;
  return rewriteFirst(
    source,
    (line) => !CAPTION.test(line) && REFERENCE.test(line),
    (line) => line.replace(REFERENCE, (_, label: string) => BY_PLACE[label] ?? label),
  );
};

export const POINTER_MUTATIONS: readonly Mutation[] = [
  { id: "figure-pointed-by-place", rule: "vague-figure-reference", languages: ["ja", "en"], plant: pointByPlace },
];
