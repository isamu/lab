import type { Detector } from "../plugin.ts";
import { entriesForGenre } from "../lexicon-genres.ts";
import { unfilledPlaceholder } from "./ai-phrasing.ts";
import { TEMPLATE, isInside, templateSections } from "./template-sections.ts";

/**
 * A blank under a heading that names a template (Template, 雛形) is what the template is for, so it is not reported.
 * Words that hold in some genres only (〇〇様 in a letter) count in those genres.
 */
export const unfilledPlaceholderOutsideTemplates: Detector = (doc, options) => {
  const lexicon = entriesForGenre(options.lexicon ?? [], options.genre);
  const words = lexicon.filter((word) => word.group === TEMPLATE);
  const templates = templateSections(doc.markup?.headings ?? [], doc.source.length, words);
  return unfilledPlaceholder(doc, { ...options, lexicon }).filter((finding) => !isInside(templates, Number(finding.values["offset"])));
};
