import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";
import { STRUCTURE_TEXT } from "../outline/structure-text.ts";
import { structureOf } from "../structure-shape/of-document.ts";
import { headedSections } from "../structure-shape/features.ts";
import { headingWords } from "../structure-shape/heading-words.ts";
import {
  FULL_TEMPLATE_SECTIONS,
  isFullTemplateOutline,
  isTemplateOutline,
  isWholeTemplateOutline,
  templateSectionsOf,
} from "../structure-shape/template-outline.ts";
import { SAME_SHAPE } from "../ai-score/signals.ts";
import { SAME_SHAPE_VALUE } from "../composite-signals.ts";

/** The template outline's name in the message, beside the structure measures past the human articles. */
const TEMPLATE_NAME: Texts<string> = { ja: "提案書・報告書の定型の見出し", en: "the textbook proposal or report headings" };

/** The name of the second count a template outline gives when it is the whole outline. */
const WHOLE_TEMPLATE_NAME: Texts<string> = { ja: "見出しのほとんどが定型", en: "almost no heading outside that outline" };

/** The name of the third count, when the whole template outline also runs through most of the template's sections. */
const FULL_TEMPLATE_NAME: Texts<string> = {
  ja: `定型の節が ${FULL_TEMPLATE_SECTIONS} 種類以上`,
  en: `${FULL_TEMPLATE_SECTIONS} or more of its sections`,
};

const headingWordsOf = (doc: ProseDocument): string[] => headedSections(doc.sections).map((section) => headingWords(section.heading));

/**
 * The template names the outline earns: one for the textbook sections, one more when they are nearly all its headings,
 * and one more again when that whole outline runs through most of the textbook.
 */
const templateNames = (doc: ProseDocument): Array<Texts<string>> => {
  const headings = headingWordsOf(doc);
  const lexicon = doc.lexicons["template-heading"] ?? [];
  if (!isTemplateOutline(templateSectionsOf(headings, lexicon))) return [];
  if (!isWholeTemplateOutline(headings, lexicon)) return [TEMPLATE_NAME];
  return isFullTemplateOutline(headings, lexicon) ? [TEMPLATE_NAME, WHOLE_TEMPLATE_NAME, FULL_TEMPLATE_NAME] : [TEMPLATE_NAME, WHOLE_TEMPLATE_NAME];
};

/**
 * The document's outline is past the human articles on several structure measures at once (chaff outline's structure
 * block): many headings, three-way splits, bold labels, uniform sections. One alone is ordinary; the limit is how many.
 * A textbook outline (Summary, Current Situation, Proposed Solution, Expected Benefits…) counts as one more, as one more
 * again when it is nearly the whole outline, and as a third when that whole outline holds six or more of its sections:
 * the textbook end to end reaches the normal limit on its own; a shorter template still needs a structure measure.
 */
export const aiStructure: Detector = (doc, options): Finding[] => {
  const scored = structureOf(doc);
  const template = templateNames(doc);
  const count = scored.score + template.length;
  if (count < options.limit) return [];
  const language = uiLanguageOf(doc.language);
  const text = STRUCTURE_TEXT[language];
  const beyond = scored.placements.filter((placement) => placement.beyond).map((placement) => placement.feature.id);
  const measures = beyond.map((id) => text.features[id].name);
  const sameShape = beyond.flatMap((id) => SAME_SHAPE[id] ?? []);
  const names = [...measures, ...template.map((name) => name[language])];
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
