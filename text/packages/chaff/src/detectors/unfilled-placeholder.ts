import type { Detector, Finding, Lexicon, ProseDocument } from "../plugin.ts";
import { entriesForGenre } from "../lexicon-genres.ts";
import { unfilledPlaceholder } from "./ai-phrasing.ts";
import { BLANK_SUFFIX, placeholderSpans } from "./placeholder-text.ts";
import { TEMPLATE, isInside, templateSections } from "./template-sections.ts";
import { tableBodyCells } from "../facts/table-facts.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { EXAMPLE_LEAD, captionsFillLine, filledFieldLabels, insideQuotedExample, lineAround } from "./placeholder-context.ts";

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
 * A bracket that is not a forgotten blank, read from the line around it: the caption of a form's fill line, a blank inside
 * a quoted example, or a field label the document fills in elsewhere.
 */
const isNamedOrExample = (doc: ProseDocument, lexicon: Lexicon): ((finding: Finding) => boolean) => {
  const leads = lexicon.filter((word) => word.group === EXAMPLE_LEAD);
  const fields = filledFieldLabels(
    doc.source,
    lexicon.filter((word) => word.group === BLANK_SUFFIX),
  );
  return (finding) => {
    const matched = String(finding.values["matched"]);
    const start = Number(finding.values["offset"]);
    const line = lineAround(doc.source, start, start + matched.length);
    return fields.has(matched) || captionsFillLine(line) || insideQuotedExample(line, leads);
  };
};

/**
 * A blank under a heading that names a template (Template, 雛形) is what the template is for, so it is not reported.
 * Words that hold in some genres only (〇〇様 in a letter) count in those genres.
 */
export const unfilledPlaceholderOutsideTemplates: Detector = (doc, options) => {
  const lexicon = entriesForGenre(options.lexicon ?? [], options.genre);
  const words = lexicon.filter((word) => word.group === TEMPLATE);
  const templates = templateSections(doc.markup?.headings ?? [], doc.source.length, words);
  const named = isNamedOrExample(doc, lexicon);
  return [...unfilledPlaceholder(doc, { ...options, lexicon }), ...cellBlanks(doc, lexicon)]
    .filter((finding) => !isInside(templates, Number(finding.values["offset"])))
    .filter((finding) => !named(finding))
    .toSorted((left, right) => Number(left.values["offset"]) - Number(right.values["offset"]));
};
