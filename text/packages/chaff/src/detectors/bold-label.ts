import type { Detector, Finding, ProseDocument, Span } from "../plugin.ts";

/** A bold run longer than this is a bold sentence, not a label. */
const MAX_LABEL_CHARS = 40;

/** The bullet or number that opens a list item. */
const ITEM_MARKER = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+/u;

/** A task box, after the marker or at the start of an item whose marker was already cut. */
const TASK_BOX = /^\[[ xX]\][ \t]+/u;

/** `**Label**: text` or `**Label:** text`. The label holds no delimiter, so `**a** and **b**: text` is not one label. */
const BOLD_LABEL = new RegExp(String.raw`^(\*\*|__)(?!\s)((?:(?!\1)[^\n]){1,${MAX_LABEL_CHARS}}?)(?:\1[ \t]*[:：]|[:：]\1)[ \t]*\S`, "u");

/** A label that is only code (`--flag`, `timeout_ms`), linked or not, names an option or a field: the way reference documentation lists them. */
const CODE_ONLY = /^(?:`[^`]+`|\[`[^`]+`\]\([^)\s]*\))$/u;

/** The label a list item opens with in bold before a colon and more text, or undefined. `item` is the item as written, marker and all. */
export const boldLabelOf = (item: string): string | undefined => {
  const label = BOLD_LABEL.exec(item.replace(ITEM_MARKER, "").replace(TASK_BOX, ""))?.[2]?.trim();
  return label === undefined || CODE_ONLY.test(label) ? undefined : label;
};

/** The list items, in document order, that open with a bold label. */
export const boldLabelItems = (doc: ProseDocument): Span[] =>
  doc.lists
    .flatMap((list) => list.itemSpans)
    .filter((span) => boldLabelOf(doc.source.slice(span.start, span.end)) !== undefined)
    .toSorted((left, right) => left.start - right.start);

/** A count, not a density: a person writes one or two labels even in a long article. */
export const boldLabelList: Detector = (doc, options): Finding[] => {
  const items = boldLabelItems(doc);
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
      values: { label: boldLabelOf(written) ?? "", count: items.length, limit: options.limit, offset: first.start },
    },
  ];
};
