import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";
import { STRUCTURE_TEXT } from "../outline/structure-text.ts";
import { structureOf } from "../structure-shape/of-document.ts";
import { headedSections } from "../structure-shape/features.ts";
import { headingWords } from "../structure-shape/heading-words.ts";
import { isTemplateOutline, isWholeTemplateOutline, templateSectionsOf } from "../structure-shape/template-outline.ts";
import { SAME_SHAPE } from "../ai-score/signals.ts";
import { SAME_SHAPE_VALUE } from "../composite-signals.ts";

/** The template outline's name in the message, beside the structure measures past the human articles. */
const TEMPLATE_NAME: Texts<string> = { ja: "提案書・報告書の定型の見出し", en: "the textbook proposal or report headings" };

/** The name of the second count a template outline gives when it is the whole outline. */
const WHOLE_TEMPLATE_NAME: Texts<string> = { ja: "見出しのほとんどが定型", en: "almost no heading outside that outline" };

const headingWordsOf = (doc: ProseDocument): string[] => headedSections(doc.sections).map((section) => headingWords(section.heading));

/** The template names the outline earns: one for the textbook sections, one more when they are nearly all its headings. */
const templateNames = (doc: ProseDocument): Array<Texts<string>> => {
  const headings = headingWordsOf(doc);
  const lexicon = doc.lexicons["template-heading"] ?? [];
  if (!isTemplateOutline(templateSectionsOf(headings, lexicon))) return [];
  return isWholeTemplateOutline(headings, lexicon) ? [TEMPLATE_NAME, WHOLE_TEMPLATE_NAME] : [TEMPLATE_NAME];
};

/**
 * The document's outline is past the human articles on several structure measures at once (chaff outline's structure
 * block): many headings, three-way splits, bold labels, uniform sections. One alone is ordinary; the limit is how many.
 * A textbook outline (Summary, Current Situation, Proposed Solution, Expected Benefits…) counts as one more, and as one
 * more again when it is nearly the whole outline; even then it needs a measure past the human articles to reach the limit.
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
