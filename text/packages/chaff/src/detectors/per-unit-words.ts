import type { ProseDocument, StructureNode } from "../plugin.ts";
import { withPerUnits, type PerUnitMark, type PerUnitTemplate, type PerUnitWords } from "../facts/per-unit.ts";
import { factValues, type FactValue } from "../facts/fact-values.ts";
import { nameSpans } from "../compare/proper-nouns.ts";

const marksOf = (doc: ProseDocument, id: string): PerUnitMark[] =>
  (doc.lexicons[id] ?? []).map((entry): PerUnitMark => ({ pattern: entry.pattern, group: entry.group ?? entry.pattern }));

/** 何あたりかの語: 決まった印（per-unit-mark）、型（fact-per-unit）、単位の語（rate-unit）、読まない百分率（percent-unit）。 */
const perUnitWordsOf = (doc: ProseDocument): PerUnitWords => ({
  marks: marksOf(doc, "per-unit-mark"),
  templates: (doc.lexicons["fact-per-unit"] ?? []).map((entry): PerUnitTemplate => ({ pattern: entry.pattern, position: entry.position ?? "before" })),
  units: marksOf(doc, "rate-unit"),
  percentUnits: (doc.lexicons["percent-unit"] ?? []).map((entry) => entry.pattern),
});

/** 文書の値に、何あたりか（1kmあたり15円 の km）を付ける。 */
export const perUnitsOf = <T extends FactValue>(doc: ProseDocument, values: readonly T[]): T[] => withPerUnits(doc.source, values, perUnitWordsOf(doc));

/** 木の数量と日付と固有名詞（factValues）に、何あたりかを付けたもの。 */
export const perUnitValues = (doc: ProseDocument, tree: StructureNode): FactValue[] => perUnitsOf(doc, factValues(tree, doc.source, nameSpans(doc)));
