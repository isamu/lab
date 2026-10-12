// A document's own code (an item code, GP-0512) labelled once — after a label in the prose, or in a table under a label —
// and written elsewhere, with no label, with two neighbours swapped (GP-0521). Pure: reads the document's text.
import type { LexiconEntry } from "./plugin.ts";
import { swapsNeighbours, withoutUrls } from "./phone-numbers.ts";
import { linesOf } from "./structure/lines.ts";
import { cellsOf, tablesOf, type Cell } from "./facts/table-facts.ts";
import { withoutEdgeMarks } from "./facts/trim-marks.ts";
import { charactersOf, MAX_CHARACTERS, MIN_DIGITS, REFERENCE_SHAPE, type ReferenceNumber, type ReferenceVariant } from "./reference-numbers.ts";

const SEPARATOR = /[-‐−－]/u;
const LATIN_LETTER = /[A-Z]/u;
const DIGIT = /\d/gu;

/** A code: letters, a hyphen and four digits or more (GP-0512). A plain number (48215, 2026-118) is never one. */
const isCode = (written: string): boolean => {
  const characters = charactersOf(written);
  return (
    SEPARATOR.test(written) && LATIN_LETTER.test(characters) && (characters.match(DIGIT)?.length ?? 0) >= MIN_DIGITS && characters.length <= MAX_CHARACTERS
  );
};

const keyOf = (text: string): string => withoutEdgeMarks(text).normalize("NFKC").toLowerCase();

/** The group of a cell that is a label and nothing else (| 品番 |, | Item code |). */
const labelOfCell = (cell: Cell | undefined, labels: readonly LexiconEntry[]): string | undefined => {
  if (cell === undefined) return undefined;
  const entry = labels.find((label) => keyOf(label.pattern) === keyOf(cell.text));
  return entry === undefined ? undefined : (entry.group ?? entry.pattern);
};

/** A cell holding one code and nothing else, as a reference number of the group. */
const codeOfCell = (cell: Cell | undefined, group: string): ReferenceNumber[] => {
  if (cell === undefined) return [];
  const written = withoutEdgeMarks(cell.text);
  if (!isCode(written) || [...written.matchAll(REFERENCE_SHAPE)].length !== 1) return [];
  return [{ offset: cell.start + cell.text.indexOf(written), written, characters: charactersOf(written), label: group }];
};

/**
 * The codes a table labels: in a row whose first cell is a label (| 品番 | GP-0512 |), and in a column whose heading is
 * one (| 品番 | 品名 | over | GP-0512 | …). Pass the text with its tables (proseAndTablesOf).
 */
export const tableLabelledCodes = (text: string, labels: readonly LexiconEntry[]): ReferenceNumber[] =>
  tablesOf(linesOf(text)).flatMap((table) => {
    const headings = cellsOf(table.header).map((cell) => labelOfCell(cell, labels));
    return table.rows.flatMap((row) => {
      const cells = cellsOf(row);
      const rowGroup = labelOfCell(cells[0], labels);
      const byRow = rowGroup === undefined ? [] : codeOfCell(cells[1], rowGroup);
      const byColumn = cells.flatMap((cell, index) => {
        const group = headings[index];
        return group === undefined ? [] : codeOfCell(cell, group);
      });
      return [...byRow, ...byColumn];
    });
  });

/** Every code written anywhere in a table, its heading row too, labelled or not: a code a table lists is an item of its own, never a slip. */
export const tableCodes = (text: string): Set<string> =>
  new Set(
    tablesOf(linesOf(text)).flatMap((table) =>
      [table.header, ...table.rows].flatMap((row) =>
        cellsOf(row).flatMap((cell) => [...cell.text.matchAll(REFERENCE_SHAPE)].filter((match) => isCode(match[0])).map((match) => charactersOf(match[0]))),
      ),
    ),
  );

/**
 * Every code of the prose written with no label that is one labelled code with two neighbours swapped. Only when exactly
 * one labelled code swaps to it, and when the writing is not itself a code the document labels or lists in a table: a
 * catalog's AB-1234 and AB-1243 are two items.
 */
export const unlabelledVariants = (prose: string, labelled: readonly ReferenceNumber[], known: ReadonlySet<string>): ReferenceVariant[] => {
  const labelledAt = new Set(labelled.map((number) => number.offset));
  const anchors = [...new Map(labelled.map((number) => [number.characters, number])).values()];
  return [...withoutUrls(prose).matchAll(REFERENCE_SHAPE)].flatMap((match) => {
    if (labelledAt.has(match.index) || !isCode(match[0])) return [];
    const characters = charactersOf(match[0]);
    if (known.has(characters) || labelled.some((number) => number.characters === characters)) return [];
    const swapped = anchors.filter((anchor) => swapsNeighbours(anchor.characters, characters));
    const [other] = swapped;
    if (swapped.length !== 1 || other === undefined) return [];
    return [{ number: { offset: match.index, written: match[0], characters, label: other.label }, other }];
  });
};
