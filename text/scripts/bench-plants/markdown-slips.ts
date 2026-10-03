// Seeded Markdown slips for `yarn bench`: a table row with one cell too many, the last code fence left unclosed, and a
// strong-emphasis mark left open. Pure and deterministic, like scripts/bench-mutations.ts.
import { codeLines, isHeading, isJapanese, isListItem, isProse, isTableRow, linesOf, replaceLine, type Mutation, type Plant } from "../bench-text.ts";

const SEPARATOR_ROW = /^\|?\s*:?-{3,}/u;
const FENCE = /^(`{3,}|~{3,})/u;

/** Adds a cell to the first body row of the first table. */
const extraCell = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const code = codeLines(lines);
  const separator = lines.findIndex((line, at) => !code.has(at) && isTableRow(line) && SEPARATOR_ROW.test(line.trim()));
  const row = separator === -1 ? undefined : lines[separator + 1];
  if (row === undefined || !isTableRow(row)) return undefined;
  const cell = isJapanese(row) ? "追記" : "note";
  return { source: replaceLine(lines, separator + 1, `${row.trimEnd()} ${cell} |`), line: separator + 2 };
};

/** Drops the closing line of the last fenced code block. */
const unclosedLastFence = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const fences = lines.flatMap((line, at) => (FENCE.test(line) ? [at] : []));
  const closing = fences.at(-1);
  const opening = fences.at(-2);
  if (closing === undefined || opening === undefined || fences.length % 2 !== 0) return undefined;
  return { source: lines.filter((_line, at) => at !== closing).join("\n"), line: opening + 1 };
};

/** Opens strong emphasis at the start of the first prose paragraph and never closes it. */
const openStrong = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const code = codeLines(lines);
  const index = lines.findIndex(
    (line, at) => !code.has(at) && isProse(line) && !isHeading(line) && !isListItem(line) && !line.includes("*") && /^\p{L}/u.test(line),
  );
  const line = lines[index];
  return line === undefined ? undefined : { source: replaceLine(lines, index, `**${line}`), line: index + 1 };
};

export const MUTATIONS: readonly Mutation[] = [
  { id: "table-extra-cell", rule: "table-row-overflow", languages: ["ja", "en"], plant: extraCell },
  { id: "code-fence-unclosed", rule: "unclosed-code-fence", languages: ["ja", "en"], plant: unclosedLastFence },
  { id: "strong-left-open", rule: "unrendered-emphasis", languages: ["ja", "en"], plant: openStrong },
];
