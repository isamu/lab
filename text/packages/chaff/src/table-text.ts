// The prose with the rows of its Markdown tables read back in. The prose masks tables, but a quote or an invoice keeps
// most of its amounts in one, and a rule comparing how amounts are written has to see them. Pure.
import { linesOf, type Line } from "./structure/lines.ts";
import { TABLE_RULE } from "./structure/runs.ts";

/** A row whose prose was masked whole, with no code in it: code in a cell stays masked. */
const readableRow = (row: Line, prose: string): boolean =>
  row.text.includes("|") && !row.text.includes("`") && prose.slice(row.start, row.start + row.text.length).trim() === "";

/** The header row (the line before |---|) and the body rows after it, up to the first line without a |. */
const tableRowsOf = (lines: readonly Line[]): Line[] =>
  lines.flatMap((line, index) => {
    const header = lines[index - 1];
    if (!TABLE_RULE.test(line.text) || header === undefined || !header.text.includes("|")) return [];
    const after = lines.slice(index + 1);
    const end = after.findIndex((row) => !row.text.includes("|"));
    return [header, ...(end === -1 ? after : after.slice(0, end))];
  });

/** The prose, with each masked table row (header and body, not the |---| rule) as the source writes it. Offsets are kept. */
export const proseWithTables = (prose: string, source: string): string => {
  const rows = tableRowsOf(linesOf(source)).filter((row) => readableRow(row, prose));
  if (rows.length === 0) return prose;
  const pieces: string[] = [];
  const end = rows.reduce((from, row) => {
    pieces.push(prose.slice(from, row.start), row.text);
    return row.start + row.text.length;
  }, 0);
  pieces.push(prose.slice(end));
  return pieces.join("");
};
