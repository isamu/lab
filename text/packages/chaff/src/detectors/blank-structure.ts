// Blanks in a Markdown document's structure: a table cell left empty in a column every other row fills, and a list
// item with nothing in it or only a label (担当：) where its siblings give one a value. Pure; reads the source's Markdown tree.
import type { Detector, Finding, ProseDocument, Span } from "../plugin.ts";
import { readMarkdown } from "../markdown-read.ts";
import { spanOf, type MarkdownNode } from "../markdown-node.ts";
import { eachPreOrder, foldPostOrder } from "../tree-walk.ts";
import { quoteAt } from "./structure-tree.ts";
import { amountColumnOf, isTotalRowGap, type BodyRow } from "../structure/total-row-blank.ts";
import { isTotalLine } from "../structure/total-line.ts";
import { isTotalLabel } from "../structure/total.ts";

/** Fewer body rows than this, and one blank is as likely a choice as a gap. */
const MIN_BODY_ROWS = 3;

/** Where a blank is, and what names it: the column's header, or the item's label. */
export type Blank = { readonly offset: number; readonly name: string };

/** The longest label an item can hold before the colon (「担当：」 "Owner:"); longer, or with a sentence mark, and it is a sentence. */
const LABEL = /^([^:：\n。．！？!?]{1,30})[:：]$/u;
const LABEL_WITH_VALUE = /^[^:：\n。．！？!?]{1,30}[:：][^\S\n]*\S/u;
/** An unchecked or checked box with nothing after it: GFM task lists are not parsed, so `[ ]` is the item's text. */
const BARE_BOX = /^\[[ xX]?\]$/u;
const EMPHASIS = /[*_]/gu;
const COMMENT = /^<!--[\s\S]*-->$/u;
const VISIBLE_LEAVES = new Set(["inlineCode", "image", "imageReference"]);

/** What a leaf shows on its own; undefined for a node whose children decide. */
const leafShows = (node: MarkdownNode): boolean | undefined => {
  if (node.type === "text") return (node.value ?? "").replace(EMPHASIS, "").trim() !== "";
  if (node.type === "html") return !COMMENT.test((node.value ?? "").trim());
  if (VISIBLE_LEAVES.has(node.type)) return true;
  return undefined;
};

/** Whether a node shows the reader anything: text that is not blank, code, an image, or HTML that is not a comment. */
const shows = (node: MarkdownNode): boolean =>
  foldPostOrder<MarkdownNode, boolean>(
    node,
    (each) => each.children ?? [],
    (each, children) => leafShows(each) ?? children.some((child) => child),
  );

const sourceOf = (source: string, node: MarkdownNode | undefined): string => {
  const span = node === undefined ? undefined : spanOf(node);
  return span === undefined ? "" : source.slice(span.start, span.end).replace(/\|/gu, "").trim();
};

const nodesOfType = (root: MarkdownNode, type: string): MarkdownNode[] => {
  const found: MarkdownNode[] = [];
  eachPreOrder(root, (node) => {
    if (node.type === type) found.push(node);
  });
  return found;
};

const outside = (spans: readonly Span[], node: MarkdownNode): boolean => {
  const span = spanOf(node);
  return span !== undefined && !spans.some((quoted) => span.start >= quoted.start && span.start < quoted.end);
};

/** Where a blank cell is: the cell itself, or the end of a row that stops before reaching the column. */
const cellOffset = (cell: MarkdownNode | undefined, row: MarkdownNode | undefined): number | undefined => {
  if (cell !== undefined) return spanOf(cell)?.start;
  return row === undefined ? undefined : spanOf(row)?.end;
};

/** Whether a row is a total, subtotal or tax row, judged from the row's source text. */
export type IsTotalRow = (rowText: string) => boolean;

const NO_TOTAL_ROWS: IsTotalRow = () => false;

const rowSource = (source: string, row: MarkdownNode): string => {
  const span = spanOf(row);
  return span === undefined ? "" : source.slice(span.start, span.end);
};

const bodyRowOf = (source: string, row: MarkdownNode, isTotalRow: IsTotalRow): BodyRow => ({
  total: isTotalRow(rowSource(source, row)),
  cells: (row.children ?? []).map((cell) => (shows(cell) ? sourceOf(source, cell) : undefined)),
});

/**
 * The one blank body cell of a column whose other body rows are all filled, unless it is a total row's blank beside its
 * amount. Such a blank still counts as a second blank, so the rows it shares a column with stay as unreported as before.
 */
const columnBlank = (source: string, header: MarkdownNode, body: readonly MarkdownNode[], rows: readonly BodyRow[], column: number): Blank[] => {
  const blanks = rows.flatMap((row, index) => (row.cells[column] === undefined ? [index] : []));
  const at = blanks[0];
  const row = at === undefined ? undefined : rows[at];
  if (blanks.length !== 1 || at === undefined || row === undefined) return [];
  if (isTotalRowGap(row, column, amountColumnOf(rows, header.children?.length ?? 0))) return [];
  const offset = cellOffset(body[at]?.children?.[column], body[at]);
  const name = sourceOf(source, header.children?.[column]);
  return offset === undefined || name === "" ? [] : [{ offset, name }];
};

/** The first column is skipped: a blank there often means "same as above". */
const tableBlanksOf = (source: string, table: MarkdownNode, isTotalRow: IsTotalRow): Blank[] => {
  const [header, ...body] = table.children ?? [];
  if (header === undefined || body.length < MIN_BODY_ROWS) return [];
  const rows = body.map((row) => bodyRowOf(source, row, isTotalRow));
  const columns = header.children?.length ?? 0;
  return Array.from({ length: columns }, (_unused, column) => column)
    .slice(1)
    .flatMap((column) => columnBlank(source, header, body, rows, column));
};

/** Quoted material is someone else's: email replies the document model found, and every Markdown blockquote. */
const quotedSpans = (root: MarkdownNode, replies: readonly Span[]): Span[] => [
  ...replies,
  ...nodesOfType(root, "blockquote").flatMap((quote) => spanOf(quote) ?? []),
];

const blocksOutsideQuotes = (source: string, type: string, replies: readonly Span[]): MarkdownNode[] => {
  const root = readMarkdown(source).root;
  const quoted = quotedSpans(root, replies);
  return nodesOfType(root, type).filter((node) => outside(quoted, node));
};

/** Blank cells in every table outside quotes. */
export const tableBlanks = (source: string, replies: readonly Span[] = [], isTotalRow: IsTotalRow = NO_TOTAL_ROWS): Blank[] =>
  blocksOutsideQuotes(source, "table", replies).flatMap((table) => tableBlanksOf(source, table, isTotalRow));

type Item = { readonly node: MarkdownNode; readonly text: string | undefined; readonly empty: boolean };

/** An item's own words, emphasis marks dropped; undefined when a nested list or block follows a lead-in. */
const itemOf = (source: string, node: MarkdownNode): Item => {
  const children = node.children ?? [];
  const text = children.length > 1 ? undefined : sourceOf(source, children[0]).replace(EMPHASIS, "").trim();
  return { node, text, empty: !children.some(shows) || BARE_BOX.test(text ?? "") };
};

const isLabelled = (item: Item): boolean => item.text !== undefined && (LABEL.test(item.text) || LABEL_WITH_VALUE.test(item.text));

/**
 * A label-only item counts as a gap only in a list of labelled items (more than half of them "label: value" or "label:", at least
 * one with a value). In a list of sentences, a label-only item is a lead-in to what follows (「次の手順で進めます：」).
 */
const isFieldList = (items: readonly Item[]): boolean => {
  const labelled = items.filter(isLabelled);
  return labelled.length * 2 > items.length && labelled.some((item) => LABEL_WITH_VALUE.test(item.text ?? ""));
};

const itemBlank = (item: Item, fields: boolean, filledSibling: boolean): Blank[] => {
  const offset = spanOf(item.node)?.start;
  if (offset === undefined || item.text === undefined) return [];
  if (item.empty) return filledSibling ? [{ offset, name: "" }] : [];
  const label = LABEL.exec(item.text)?.[1];
  return label !== undefined && fields ? [{ offset, name: label.trim() }] : [];
};

/** An empty item is reported only beside a filled one: a list of one empty item is a numbering left over (「40.」). */
const listBlanksOf = (source: string, list: MarkdownNode): Blank[] => {
  const items = (list.children ?? []).filter((child) => child.type === "listItem").map((node) => itemOf(source, node));
  const fields = isFieldList(items);
  const filledSibling = items.some((item) => !item.empty);
  return items.flatMap((item) => itemBlank(item, fields, filledSibling));
};

/** Empty items, and label-only items in a list of labelled fields, outside quotes. */
export const listBlanks = (source: string, replies: readonly Span[] = []): Blank[] =>
  blocksOutsideQuotes(source, "list", replies).flatMap((list) => listBlanksOf(source, list));

const findingsOf =
  (rule: string, blanksOf: (doc: ProseDocument) => Blank[]): Detector =>
  (doc: ProseDocument): Finding[] =>
    blanksOf(doc).map((blank) => ({
      rule,
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, blank.offset),
      ...(blank.name === "" ? { variant: "empty" } : {}),
      values: { name: blank.name, offset: blank.offset },
    }));

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

/** A total row starts with a total word (total-label, with total-label-qualifier) or a tax word (tax-label). */
const totalRowOf = (doc: ProseDocument): IsTotalRow => {
  const totals = { labels: patternsOf(doc, "total-label"), qualifiers: doc.lexicons["total-label-qualifier"] ?? [] };
  const taxes = patternsOf(doc, "tax-label");
  return (rowText) => isTotalLine(rowText, totals) || isTotalLabel(rowText, taxes);
};

export const emptyTableCell: Detector = findingsOf("empty-table-cell", (doc) => tableBlanks(doc.source, doc.replyQuotes ?? [], totalRowOf(doc)));
export const emptyListItem: Detector = findingsOf("empty-list-item", (doc) => listBlanks(doc.source, doc.replyQuotes ?? []));
