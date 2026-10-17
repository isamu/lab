// A row label that spans two columns in the table it was converted from (| Total score |  | 5 |): Markdown has no column
// span, so the cell right after the label is left blank and the value follows. Pure; the caller passes the total words.

/** A note in parentheses at the end of a label (Total score (count of all "yes" answers above)), dropped before reading it. */
const TRAILING_NOTE = /[(（][^()（）]*[)）]$/u;
const EMPHASIS = /[*_]/gu;
const COLON_END = /[:：]$/u;
const LATIN_LETTER = /\p{Script=Latin}/u;

const labelText = (cell: string): string => cell.replace(EMPHASIS, "").trim().replace(TRAILING_NOTE, "").trim();

/**
 * Whether `word` stands at the start or the end of `label` as a word of its own: no Latin letter runs on from it. A word of
 * one character (計) must be the whole label, since it starts or ends many words (計画, 設計).
 */
const startsOrEndsWith = (label: string, word: string): boolean => {
  const lower = label.toLowerCase();
  const target = word.toLowerCase();
  if (Array.from(target).length === 1) return lower === target;
  const after = lower.charAt(target.length);
  const before = lower.charAt(lower.length - target.length - 1);
  return (lower.startsWith(target) && !LATIN_LETTER.test(after)) || (lower.endsWith(target) && !LATIN_LETTER.test(before));
};

/** A label: it ends in a colon (Total:), or a total word starts or ends it (Total score, 得点合計). */
export const isSpanningLabel = (cell: string, totalWords: readonly string[]): boolean => {
  const label = labelText(cell);
  if (label === "") return false;
  return COLON_END.test(label) || totalWords.some((word) => word !== "" && startsOrEndsWith(label, word));
};

/**
 * Whether the blank at `column` is the second half of a label that spans two columns: the cell before it holds such a label
 * and the cell after it is filled. Cells are undefined when blank.
 */
export const isSpannedLabelGap = (cells: readonly (string | undefined)[], column: number, totalWords: readonly string[]): boolean => {
  const label = cells[column - 1];
  return cells[column] === undefined && cells[column + 1] !== undefined && label !== undefined && isSpanningLabel(label, totalWords);
};
