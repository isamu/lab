import type { ProseDocument, Span, StructureNode } from "../plugin.ts";
import { alternativeReader, placeholderStarts } from "../structure/alternative-clause.ts";
import { htmlTextBlocks } from "../structure/html-text-blocks.ts";
import type { ClauseReadings } from "../structure/numbering.ts";
import { sideStepReader } from "../structure/side-step.ts";
import { patternsOf } from "./net-amount-mismatch.ts";

/**
 * What numberingBreaks reads besides the tree, from the document and its word lists: the text the tree leaves out (an
 * HTML block's, in Markdown), the steps labelled with a word, the alternative and blank-numbered clauses.
 */
export const numberingReadings = (
  doc: ProseDocument,
  source: string,
): [unread: Span[], isSideStep: (node: StructureNode) => boolean, clauses: ClauseReadings] => [
  doc.markup?.markdown === true ? htmlTextBlocks(source) : [],
  sideStepReader(patternsOf(doc, "side-step-label")),
  {
    isAlternative: alternativeReader(source, patternsOf(doc, "alternative-clause-label")),
    restarts: placeholderStarts(source, patternsOf(doc, "placeholder-division")),
  },
];
