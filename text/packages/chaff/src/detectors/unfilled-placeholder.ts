import type { Detector, Finding, Lexicon, ProseDocument } from "../plugin.ts";
import { entriesForGenre } from "../lexicon-genres.ts";
import { unfilledPlaceholder } from "./ai-phrasing.ts";
import { placeholderSpans } from "./placeholder-text.ts";
import { TEMPLATE, isInside, templateSections } from "./template-sections.ts";
import { tableBodyCells } from "../facts/table-facts.ts";
import { proseAndTablesOf } from "../table-text.ts";

/** The prose covers tables, so a blank left in a cell (| Owner | [Name] |) is read from the cells themselves. */
const cellBlanks = (doc: ProseDocument, lexicon: Lexicon): Finding[] =>
  tableBodyCells(proseAndTablesOf(doc)).flatMap((cell) =>
    placeholderSpans(cell.text, lexicon).map((span) => ({
      rule: "",
      severity: "info" as const,
      line: 0,
      column: 0,
      quote: cell.text.trim(),
      values: { matched: cell.text.slice(span.start, span.end), offset: cell.start + span.start },
    })),
  );

/**
 * A blank under a heading that names a template (Template, 雛形) is what the template is for, so it is not reported.
 * Words that hold in some genres only (〇〇様 in a letter) count in those genres.
 */
export const unfilledPlaceholderOutsideTemplates: Detector = (doc, options) => {
  const lexicon = entriesForGenre(options.lexicon ?? [], options.genre);
  const words = lexicon.filter((word) => word.group === TEMPLATE);
  const templates = templateSections(doc.markup?.headings ?? [], doc.source.length, words);
  return [...unfilledPlaceholder(doc, { ...options, lexicon }), ...cellBlanks(doc, lexicon)]
    .filter((finding) => !isInside(templates, Number(finding.values["offset"])))
    .toSorted((left, right) => Number(left.values["offset"]) - Number(right.values["offset"]));
};
