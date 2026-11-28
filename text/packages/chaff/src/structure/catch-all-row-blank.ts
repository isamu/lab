// The last row of an if-then table that catches every case the rows above leave (| none of the above apply | | 10 percent |):
// the conditions it leaves blank do not apply to it. Pure; the caller passes the catch-all words.

const EMPHASIS = /[*_]/gu;
const LATIN_LETTER = /\p{Script=Latin}/u;

/** Whether a row's label opens with a catch-all word (none of the above, otherwise, 上記以外) standing as a word of its own. */
export const isCatchAllLabel = (cell: string | undefined, catchAllWords: readonly string[]): boolean => {
  const label = (cell ?? "").replace(EMPHASIS, "").trim().toLowerCase();
  return catchAllWords.some((word) => {
    const target = word.toLowerCase();
    return target !== "" && label.startsWith(target) && !LATIN_LETTER.test(label.charAt(target.length));
  });
};

/**
 * Whether the blank at `column` is a condition a catch-all row leaves out: the row's first cell opens with a catch-all word
 * and a later cell is filled, its outcome. A blank in the outcome itself, the row's last filled place, is still a gap. Cells
 * are undefined when blank.
 */
export const isCatchAllRowGap = (cells: readonly (string | undefined)[], column: number, catchAllWords: readonly string[]): boolean =>
  cells[column] === undefined && cells.slice(column + 1).some((cell) => cell !== undefined) && isCatchAllLabel(cells[0], catchAllWords);
