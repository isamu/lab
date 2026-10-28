import type { Detector, Finding, ProseDocument, Span } from "../plugin.ts";

/** A bold run longer than this is a bold sentence, not a label. */
const MAX_LABEL_CHARS = 40;

/** The bullet or number that opens a list item. */
const ITEM_MARKER = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+/u;

/** A task box, after the marker or at the start of an item whose marker was already cut. */
const TASK_BOX = /^\[[ xX]\][ \t]+/u;

/** `**Label**: text` or `**Label:** text`. The label holds no delimiter, so `**a** and **b**: text` is not one label. */
const BOLD_LABEL = new RegExp(String.raw`^(\*\*|__)(?!\s)((?:(?!\1)[^\n]){1,${MAX_LABEL_CHARS}}?)(?:\1[ \t]*[:：]|[:：]\1)[ \t]*\S`, "u");

/** A label that is only code (`--flag`, `timeout_ms`) names an option or a field: the way reference documentation lists them. */
const CODE_SPAN = /^`[^`]+`$/u;

/** A link around the whole label: inline, reference, collapsed or shortcut. Its text is what the reader sees. */
const WHOLE_LINK = /^\[([^\]\n]+)\](?:\([^)\s]*\)|\[[^\]\n]*\])?$/u;

const isCodeOnly = (label: string): boolean => CODE_SPAN.test(label.replace(WHOLE_LINK, "$1"));

/** The label a list item opens with in bold before a colon and more text, or undefined. `item` is the item as written, marker and all. */
export const boldLabelOf = (item: string): string | undefined => {
  const label = BOLD_LABEL.exec(item.replace(ITEM_MARKER, "").replace(TASK_BOX, ""))?.[2]?.trim();
  return label === undefined || isCodeOnly(label) ? undefined : label;
};

/** Whether an item opens with a bold label of any kind, code-only ones included: bold that labels rather than emphasises. */
export const opensWithBoldLabel = (item: string): boolean => BOLD_LABEL.test(item.replace(ITEM_MARKER, "").replace(TASK_BOX, ""));

/** Whether the line holding `offset` is quoted (`> - **a**：…`): someone else's words, not the writer's to fix. */
export const isQuotedAt = (source: string, offset: number): boolean => source.slice(source.lastIndexOf("\n", offset - 1) + 1, offset).includes(">");

/** A bold run longer than this is a paragraph in bold, not a lead sentence. */
const MAX_LEAD_CHARS = 80;

/** `**Label.** text`: a bold lead sentence, its stop inside the bold, then the item goes on. The same label, closed by a stop instead of a colon. */
const BOLD_LEAD = new RegExp(String.raw`^(\*\*|__)(?!\s)((?:(?!\1)[^\n]){1,${MAX_LEAD_CHARS}}?[.!?。！？])\1[ \t]*\S`, "u");

/** The lead sentence a list item opens with in bold, its stop left off, or undefined. `item` is the item as written, marker and all. */
export const boldLeadOf = (item: string): string | undefined =>
  BOLD_LEAD.exec(item.replace(ITEM_MARKER, "").replace(TASK_BOX, ""))?.[2]
    ?.trim()
    .replace(/[.!?。！？]$/u, "");

const labelOrLeadOf = (item: string): string | undefined => boldLabelOf(item) ?? boldLeadOf(item);

const unquotedItems = (doc: ProseDocument, opens: (item: string) => string | undefined): Span[] =>
  doc.lists
    .flatMap((list) => list.itemSpans)
    .filter((span) => !isQuotedAt(doc.source, span.start) && opens(doc.source.slice(span.start, span.end)) !== undefined)
    .toSorted((left, right) => left.start - right.start);

/** The list items, in document order, that open with a bold label and are not quoted. */
export const boldLabelItems = (doc: ProseDocument): Span[] => unquotedItems(doc, boldLabelOf);

/** A count, not a density: a person writes one or two labels even in a long article. A bold lead sentence counts as a label. */
export const boldLabelList: Detector = (doc, options): Finding[] => {
  const items = unquotedItems(doc, labelOrLeadOf);
  const first = items[0];
  if (first === undefined || items.length < options.limit) return [];
  const written = doc.source.slice(first.start, first.end);
  return [
    {
      rule: "bold-label-list",
      severity: "info",
      line: 0,
      column: 0,
      quote: (written.split("\n")[0] ?? "").trim(),
      values: { label: labelOrLeadOf(written) ?? "", count: items.length, limit: options.limit, offset: first.start },
    },
  ];
};
