// The columns of a lab or checkup results table, named by their headings: the result, the reference range, the flag and
// the unit. reference-flag-mismatch and reference-unit-mismatch both read a table through this; each brings its own way of
// reducing a heading (which brackets it leaves out) and its own choice of which columns it needs. Pure.

export type LabColumn = "result" | "range" | "flag" | "unit";

export type LabColumnWord = { readonly pattern: string; readonly column: LabColumn };

/** A heading reduced to what is compared with the words: case, width and a note in brackets left out. */
type HeadingKey = (heading: string) => string;

const LAB_COLUMNS: ReadonlySet<string> = new Set<LabColumn>(["result", "range", "flag", "unit"]);

export const isLabColumn = (group: string | undefined): group is LabColumn => group !== undefined && LAB_COLUMNS.has(group);

/** The column each heading names, by the first word whose key is the heading's key; undefined for a heading no word names. */
export const labColumnsOf = (headings: readonly string[], words: readonly LabColumnWord[], keyOf: HeadingKey): (LabColumn | undefined)[] =>
  headings.map((heading) => {
    const key = keyOf(heading);
    return words.find((word) => keyOf(word.pattern) === key)?.column;
  });
