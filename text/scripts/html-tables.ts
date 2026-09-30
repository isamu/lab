// Tables as the HTML converter reads them. A table whose rows are sentences (a glossary of terms and what they mean,
// a list of routes and how each one works) keeps each cell as a block of its own, so its sentences are read as prose;
// its header rows go. Any other table (figures, a grid of links) goes whole, as before. Nested tables are read from
// the inside out. Pure; a regular-expression reading, not a parser.
import { plainText, untilStable } from "./html-elements.ts";

type Cell = { readonly header: boolean; readonly html: string };
type Row = readonly Cell[];

const INNERMOST_TABLE = /<table\b[^>]*>((?:(?!<table\b)[\s\S])*?)<\/table\s*>/giu;

// A row and a cell may leave out their closing tags: each ends where the next one opens.
const ROW_OPENING = /<tr\b[^>]*>/iu;
const ROW_END = /<\/(?:tr|thead|tbody|tfoot)\s*>[\s\S]*$/iu;
const CELL_OPENING = /<(t[dh])\b[^>]*>/giu;
const CELL_END = /<\/t[dh]\s*>[\s\S]*$/iu;

const cellsOf = (row: string): Row => {
  const openings = [...row.matchAll(CELL_OPENING)];
  return openings.map((opening, index) => {
    const end = openings[index + 1]?.index ?? row.length;
    const html = row.slice(opening.index + opening[0].length, end).replace(CELL_END, "");
    return { header: opening[1]?.toLowerCase() === "th", html };
  });
};

const rowsOf = (table: string): Row[] =>
  table
    .split(ROW_OPENING)
    .slice(1)
    .map((row) => cellsOf(row.replace(ROW_END, "")));

const hasText = (cell: Cell): boolean => plainText(cell.html) !== "";

// A cell ends a sentence with its last mark; a point inside it ("H.Con.Res. 218", "U.S. Code") is an abbreviation.
const ENDS_SENTENCE = /[。．！？.!?][)\]"'”’」』）]*$/u;

const holdsSentence = (cell: Cell): boolean => ENDS_SENTENCE.test(plainText(cell.html));

/**
 * A cell kept as a block: one with a sentence, or a label in words. A label that opens with a number (a row number, a
 * range of figures) is read by no prose rule, and alone on a line it would read as a section number.
 */
const isKept = (cell: Cell): boolean => holdsSentence(cell) || (hasText(cell) && !/^\p{Nd}/u.test(plainText(cell.html)));

/** A row of nothing but header cells labels the columns. */
const isHeaderRow = (row: Row): boolean => row.length > 0 && row.every((cell) => cell.header);

/** At least half of the rows with text in them hold a sentence. */
const isProse = (rows: readonly Row[]): boolean => {
  const written = rows.filter((row) => row.some(hasText));
  const sentences = written.filter((row) => row.some(holdsSentence)).length;
  return sentences > 0 && sentences * 2 >= written.length;
};

const CAPTION = /<caption\b[^>]*>([\s\S]*?)<\/caption\s*>/iu;

/** Each cell with text as a block, the caption first. */
const asBlocks = (table: string, rows: readonly Row[]): string => {
  const caption = CAPTION.exec(table)?.[1];
  const cells = rows.filter((row) => !isHeaderRow(row)).flatMap((row) => row.filter(isKept).map((cell) => cell.html));
  return ["<div>", ...[caption ?? "", ...cells].filter((html) => html !== "").map((html) => `<div>${html}</div>`), "</div>"].join("");
};

const readTable = (_whole: string, inside: string): string => {
  const rows = rowsOf(inside);
  return isProse(rows) ? asBlocks(inside, rows) : " ";
};

/** Every table read from the inside out: a table of sentences as blocks, any other table replaced by a space. */
export const withTablesRead = (html: string): string => untilStable(html, (text) => text.replace(INNERMOST_TABLE, readTable));
