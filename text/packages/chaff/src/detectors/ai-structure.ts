import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";
import { STRUCTURE_TEXT } from "../outline/structure-text.ts";
import { structureOf } from "../structure-shape/of-document.ts";
import { headedSections } from "../structure-shape/features.ts";
import { headingWords } from "../structure-shape/heading-words.ts";
import { isTemplateOutline, templateSectionsOf } from "../structure-shape/template-outline.ts";
import { SAME_SHAPE } from "../ai-score/signals.ts";
import { SAME_SHAPE_VALUE } from "../composite-signals.ts";

/** The template outline's name in the message, beside the structure measures past the human articles. */
const TEMPLATE_NAME: Texts<string> = { ja: "提案書・報告書の定型の見出し", en: "the textbook proposal or report headings" };

const templateSections = (doc: ProseDocument): string[] =>
  templateSectionsOf(
    headedSections(doc.sections).map((section) => headingWords(section.heading)),
    doc.lexicons["template-heading"] ?? [],
  );

/**
 * The document's outline is past the human articles on several structure measures at once (chaff outline's structure
 * block): many headings, three-way splits, bold labels, uniform sections. One alone is ordinary; the limit is how many.
 * A textbook outline (Summary, Current Situation, Proposed Solution, Expected Benefits…) counts as one more.
 */
export const aiStructure: Detector = (doc, options): Finding[] => {
  const scored = structureOf(doc);
  const template = isTemplateOutline(templateSections(doc));
  const count = scored.score + (template ? 1 : 0);
  if (count < options.limit) return [];
  const language = uiLanguageOf(doc.language);
  const text = STRUCTURE_TEXT[language];
  const beyond = scored.placements.filter((placement) => placement.beyond).map((placement) => placement.feature.id);
  const measures = beyond.map((id) => text.features[id].name);
  const sameShape = beyond.flatMap((id) => SAME_SHAPE[id] ?? []);
  const names = template ? [...measures, TEMPLATE_NAME[language]] : measures;
  const heading = (doc.markup?.headings ?? []).find((entry) => entry.depth > 1) ?? doc.markup?.headings[0];
  return [
    {
      rule: "ai-structure",
      severity: "info",
      line: 0,
      column: 0,
      quote: heading?.text ?? "",
      values: { word: names.join(text.listSeparator), count, limit: options.limit, offset: heading?.start ?? 0, [SAME_SHAPE_VALUE]: sameShape.join(",") },
    },
  ];
};
