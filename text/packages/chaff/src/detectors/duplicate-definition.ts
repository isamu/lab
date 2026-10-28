import type { Detector, ProseDocument, StructureNode } from "../plugin.ts";
import { duplicateDefinitions } from "../structure/issues.ts";
import { attachedPartStarts } from "../structure/attached-parts.ts";
import { alternativeReader, choiceReader } from "../structure/alternative-clause.ts";
import { findingsOf } from "./structure-tree.ts";
import { patternsOf } from "./net-amount-mismatch.ts";

/** A clause to choose instead of another: named an alternative (alternative-clause-label) or one of numbered options (option-choice-label). */
const choicesOf = (doc: ProseDocument, source: string): ((node: StructureNode) => boolean) => {
  const isAlternative = alternativeReader(source, patternsOf(doc, "alternative-clause-label"));
  const isChoice = choiceReader(source, patternsOf(doc, "option-choice-label"));
  return (node) => isAlternative(node) || isChoice(node);
};

export const duplicateDefinition: Detector = (doc, options) => {
  const labels = patternsOf(doc, "attached-instrument-label");
  return findingsOf("duplicate-definition", (tree, source) => duplicateDefinitions(tree, attachedPartStarts(source, labels), source, choicesOf(doc, source)))(
    doc,
    options,
  );
};
