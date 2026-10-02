// The column headers of a document's tables, and the ones written two ways (担当者 / 担当, Owner / Owners, E-mail / Email).
// Pure; reads the Markdown table rows from the source. Which spelling is right is the writer's choice, so the less common
// one is reported. The affixes that leave a label's meaning alone (者, 欄; s, es) come from the language's lexicon.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";

/** One header cell: its words as written (markup dropped), and where they start in the document. */
export type HeaderCell = { readonly written: string; readonly offset: number };

const FENCE = /^ {0,3}(`{3,}|~{3,})/u;
const INDENTED_CODE = /^(?: {4}|\t)/u;
const DELIMITER_CELL = /^:?-+:?$/u;
const CELL_SEPARATOR = /(?<!\\)\|/gu;

const INNER_MARKS = /[*`]/gu;

/** Emphasis and code marks around a header's words (**Owner**, `id`); an underscore inside a word (user_id) stays. */
const isWrappingMark = (char: string): boolean => char === "*" || char === "_" || char === "`";

const unwrap = (text: string): string => {
  const chars = [...text];
  const from = chars.findIndex((char) => !isWrappingMark(char));
  return from === -1 ? "" : chars.slice(from, chars.findLastIndex((char) => !isWrappingMark(char)) + 1).join("");
};

type Line = { readonly text: string; readonly start: number };

const linesOf = (source: string): Line[] => {
  const starts = [0, ...[...source.matchAll(/\n/gu)].map((match) => match.index + 1)];
  return starts.map((start, index) => ({ text: source.slice(start, (starts[index + 1] ?? source.length + 1) - 1), start }));
};

/** The lines outside fenced and indented code: a table written in a code sample is the sample's. A fence closes on its own mark. */
const outsideCode = (lines: readonly Line[]): Line[] => {
  const kept: Line[] = [];
  lines.reduce<string | undefined>((open, line) => {
    const fence = FENCE.exec(line.text)?.[1];
    if (open !== undefined) return fence !== undefined && fence[0] === open[0] && fence.length >= open.length ? undefined : open;
    if (fence !== undefined) return fence;
    if (!INDENTED_CODE.test(line.text)) kept.push(line);
    return undefined;
  }, undefined);
  return kept;
};

/** The cells of a table row as written, the pipes at either end dropped. */
const rawCells = (line: Line): { readonly raw: string; readonly from: number }[] => {
  const bounds = [-1, ...[...line.text.matchAll(CELL_SEPARATOR)].map((match) => match.index), line.text.length];
  const cells = bounds.slice(1).map((end, index) => {
    const from = (bounds[index] ?? -1) + 1;
    return { raw: line.text.slice(from, end), from };
  });
  const inner = cells.slice(cells[0]?.raw.trim() === "" ? 1 : 0);
  return inner.at(-1)?.raw.trim() === "" ? inner.slice(0, -1) : inner;
};

const labelCell = (line: Line, { raw, from }: { readonly raw: string; readonly from: number }): HeaderCell[] => {
  const trimmed = raw.trim();
  const unwrapped = unwrap(trimmed);
  const written = unwrapped.replace(INNER_MARKS, "").trim();
  const lead = raw.indexOf(trimmed) + trimmed.indexOf(unwrapped.trimStart());
  return /\p{L}/u.test(written) ? [{ written, offset: line.start + from + lead }] : [];
};

/** The |---|:-:| row under a table's header: one dash cell per header cell, with a colon at either end for alignment. */
const isDelimiterRow = (line: Line | undefined, columns: number): boolean => {
  if (line === undefined) return false;
  const cells = rawCells(line);
  return cells.length === columns && cells.every((cell) => DELIMITER_CELL.test(cell.raw.trim()));
};

const isTableRow = (line: Line | undefined): line is Line => line !== undefined && line.text.includes("|") && line.text.trim() !== "";

/** The body rows of the table whose delimiter row is at index: every row with a pipe up to the first line without one. */
const bodyRows = (lines: readonly Line[], delimiter: number): Line[] => {
  const rows: Line[] = [];
  for (let at = delimiter + 1; at < lines.length; at += 1) {
    const row = lines[at];
    if (!isTableRow(row)) break;
    rows.push(row);
  }
  return rows;
};

/** Two columns: a table of fields and their values (担当者 | 山田). */
const FIELD_TABLE_COLUMNS = 2;

/**
 * The label cells of every Markdown table: the header row (the row right above a |---| row), and in a two-column table
 * also the first cell of each row, which names a field.
 */
export const tableHeaderCells = (source: string): HeaderCell[] => {
  const lines = outsideCode(linesOf(source));
  return lines.flatMap((line, index) => {
    const header = isTableRow(line) ? rawCells(line) : [];
    if (header.length === 0 || !isDelimiterRow(lines[index + 1], header.length)) return [];
    const labels = header.flatMap((cell) => labelCell(line, cell));
    if (header.length !== FIELD_TABLE_COLUMNS) return labels;
    const fields = bodyRows(lines, index + 1).flatMap((row) =>
      rawCells(row)
        .slice(0, 1)
        .flatMap((cell) => labelCell(row, cell)),
    );
    return [...labels, ...fields];
  });
};

/** The form two spellings of one label share: width, case, spaces, hyphens and middle dots folded. */
export const foldedLabel = (written: string): string =>
  written
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-‐・·._]/gu, "");

/** A stem shorter than this matches too much (名 against 名前, s against anything). */
const MIN_STEM = 2;

/** The label and each stem left by dropping one affix the language says does not change it (担当者 → 担当, owners → owner). */
export const labelKeys = (written: string, affixes: readonly string[]): Set<string> => {
  const folded = foldedLabel(written);
  const stems = affixes
    .filter((affix) => folded.endsWith(affix) && [...folded].length - [...affix].length >= MIN_STEM)
    .map((affix) => folded.slice(0, -affix.length));
  return new Set([folded, ...stems]);
};

const shareKey = (left: ReadonlySet<string>, right: ReadonlySet<string>): boolean => [...left].some((key) => right.has(key));

/** The cells grouped by label: two cells are one label when they share a key. Each group in document order. */
export const labelGroups = (cells: readonly HeaderCell[], affixes: readonly string[]): HeaderCell[][] => {
  const keyed = cells.map((cell) => ({ cell, keys: labelKeys(cell.written, affixes) }));
  const groups: { keys: Set<string>; cells: HeaderCell[] }[] = [];
  keyed.forEach(({ cell, keys }) => {
    const joined = groups.filter((group) => shareKey(group.keys, keys));
    const merged = { keys: new Set([...keys, ...joined.flatMap((group) => [...group.keys])]), cells: [...joined.flatMap((group) => group.cells), cell] };
    joined.forEach((group) => groups.splice(groups.indexOf(group), 1));
    groups.push(merged);
  });
  return groups
    .map((group) => group.cells.toSorted((left, right) => left.offset - right.offset))
    .toSorted((left, right) => (left[0]?.offset ?? 0) - (right[0]?.offset ?? 0));
};

const PERCENT = 100;

/**
 * The cells of one label not written the usual way. The usual way is the most common spelling; on a tie, the first one.
 * Nothing when the other spellings together are more than limitPercent of the label's cells.
 */
export const oddSpellings = (cells: readonly HeaderCell[], limitPercent: number): { readonly odd: HeaderCell[]; readonly usual: string } => {
  const counts = new Map<string, number>();
  cells.forEach((cell) => counts.set(cell.written, (counts.get(cell.written) ?? 0) + 1));
  const most = Math.max(0, ...counts.values());
  const usual = cells.find((cell) => counts.get(cell.written) === most)?.written ?? "";
  const odd = cells.filter((cell) => cell.written !== usual);
  return odd.length * PERCENT > limitPercent * cells.length ? { odd: [], usual } : { odd, usual };
};

const findingOf = (cell: HeaderCell, usual: string, count: number, of: number, limit: number): Finding => ({
  rule: "table-header-variant",
  severity: "info",
  line: 0,
  column: 0,
  quote: cell.written,
  values: { written: cell.written, usual, count, of, limit, offset: cell.offset },
});

/** Each table header cell whose label the document's other tables write another way. */
export const tableHeaderVariant: Detector = (doc: ProseDocument, options): Finding[] => {
  const affixes = (doc.lexicons["label-affix"] ?? []).map((entry) => foldedLabel(entry.pattern));
  return labelGroups(tableHeaderCells(doc.source), affixes).flatMap((cells) => {
    const { odd, usual } = oddSpellings(cells, options.limit);
    return odd.map((cell) => findingOf(cell, usual, odd.length, cells.length, options.limit));
  });
};
