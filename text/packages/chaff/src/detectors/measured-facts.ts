import type { ProseDocument, StructureNode } from "../plugin.ts";
import { nameSpans } from "../compare/proper-nouns.ts";
import { overlapsAny, spanIndex } from "../compare/spans.ts";
import { factValues, type FactValue } from "../facts/fact-values.ts";
import { codeFences } from "./code-fences.ts";
import { measuredValues, type Measured } from "../facts/measures.ts";
import { measureUnitsOf } from "../facts/measure-units.ts";

/** 文書の中の、単位の語彙表の単位が付いた量。コードの塊の中の量は、項目の値ではない。 */
export const measuredOf = (doc: ProseDocument): Measured[] => {
  const fences = codeFences(doc.source);
  return measuredValues(doc.source, measureUnitsOf(doc)).filter((value) => !fences.some((fence) => fence.start <= value.start && value.end <= fence.end));
};

/** fact-conflict の値に、単位の付いた量を足す。量と重なる値（量の数だけを読んだもの）は量に置き換える。 */
export const valuesWith = (tree: StructureNode, doc: ProseDocument, measured: readonly FactValue[]): FactValue[] => {
  const taken = spanIndex(measured);
  const others = factValues(tree, doc.source, nameSpans(doc)).filter((value) => !overlapsAny(taken, value));
  return [...others, ...measured].toSorted((left, right) => left.start - right.start);
};
