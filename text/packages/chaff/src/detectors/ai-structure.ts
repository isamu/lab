import type { Detector, Finding } from "../plugin.ts";
import { uiLanguageOf } from "../ui.ts";
import { STRUCTURE_TEXT } from "../outline/structure-text.ts";
import { structureOf } from "../structure-shape/of-document.ts";

/**
 * The document's outline is past the human articles on several structure measures at once (chaff outline's structure
 * block): many headings, three-way splits, bold labels, uniform sections. One alone is ordinary; the limit is how many.
 */
export const aiStructure: Detector = (doc, options): Finding[] => {
  const scored = structureOf(doc);
  if (scored.score < options.limit) return [];
  const text = STRUCTURE_TEXT[uiLanguageOf(doc.language)];
  const names = scored.placements.filter((placement) => placement.beyond).map((placement) => text.features[placement.feature.id].name);
  const heading = (doc.markup?.headings ?? []).find((entry) => entry.depth > 1) ?? doc.markup?.headings[0];
  return [
    {
      rule: "ai-structure",
      severity: "info",
      line: 0,
      column: 0,
      quote: heading?.text ?? "",
      values: { word: names.join(text.listSeparator), count: scored.score, limit: options.limit, offset: heading?.start ?? 0 },
    },
  ];
};
