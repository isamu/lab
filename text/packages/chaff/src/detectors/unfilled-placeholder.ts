import type { Detector } from "../plugin.ts";
import { unfilledPlaceholder } from "./ai-phrasing.ts";
import { TEMPLATE, isInside, templateSections } from "./template-sections.ts";

/** A blank under a heading that names a template (Template, 雛形) is what the template is for, so it is not reported. */
export const unfilledPlaceholderOutsideTemplates: Detector = (doc, options) => {
  const words = (options.lexicon ?? []).filter((word) => word.group === TEMPLATE);
  const templates = templateSections(doc.markup?.headings ?? [], doc.source.length, words);
  return unfilledPlaceholder(doc, options).filter((finding) => !isInside(templates, Number(finding.values["offset"])));
};
