// The prose with its Markdown tables read back in. The prose masks tables, but a quote or an invoice keeps most of its
// amounts in one, and a rule comparing how amounts are written has to see them.
import type { ProseDocument, Span } from "./plugin.ts";
import { maskSpans } from "./mask.ts";
import { opaqueSpans, readMarkdown, spansOfType } from "./markdown-read.ts";
import { TABLE_RULE } from "./structure/runs.ts";

const within = (inner: Span, outer: Span): boolean => inner.start >= outer.start && inner.end <= outer.end;

/**
 * The prose, with each table span as the source writes it, except what stays hidden inside it (code in a cell). Offsets
 * are kept. Pure.
 */
export const proseWithTables = (prose: string, source: string, tables: readonly Span[], hidden: readonly Span[]): string => {
  if (tables.length === 0) return prose;
  const shown = maskSpans(source, hidden);
  const pieces: string[] = [];
  const end = tables
    .toSorted((left, right) => left.start - right.start)
    .reduce((from, table) => {
      if (table.start < from) return from;
      pieces.push(prose.slice(from, table.start), shown.slice(table.start, table.end));
      return table.end;
    }, 0);
  pieces.push(prose.slice(end));
  return pieces.join("");
};

const hasTableRule = (source: string): boolean => source.split("\n").some((line) => TABLE_RULE.test(line) && line.includes("-"));

/** The document's prose with its tables, outside code and quoted replies. A document that is not Markdown keeps its prose. */
export const proseAndTablesOf = (doc: ProseDocument): string => {
  const prose = doc.prose ?? doc.source;
  if (doc.prose === undefined || doc.markup?.markdown !== true || !hasTableRule(doc.source)) return prose;
  const { root } = readMarkdown(doc.source);
  const quoted = [...spansOfType(root, "blockquote"), ...(doc.replyQuotes ?? [])];
  const tables = spansOfType(root, "table").filter((table) => !quoted.some((quote) => within(table, quote)));
  return proseWithTables(doc.prose, doc.source, tables, opaqueSpans(root));
};
