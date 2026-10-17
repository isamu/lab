// A code block that holds only a format template: named placeholders joined by separators (<MAJOR>.<MINOR>.<PATCH>,
// {year}-{month}). It shows the shape of a value, not code in any language, so it has no language to name. Pure.

const PLACEHOLDER = /<[A-Za-z][\w-]*>|\{[A-Za-z][\w-]*\}/gu;
const SEPARATORS = /^\s*[.,:;/_+\-|][\s.,:;/_+\-|]*$/u;
/** A lone tag (`<div>`) or two tags side by side are markup; a template joins two or more parts with a separator. */
const MIN_PARTS = 2;

const isTemplateLine = (line: string): boolean => (line.match(PLACEHOLDER) ?? []).length >= MIN_PARTS && SEPARATORS.test(line.replace(PLACEHOLDER, ""));

/** Whether every non-blank line is two or more placeholders joined by separators, with at least one such line. */
export const isFormatTemplate = (lines: readonly string[]): boolean => {
  const filled = lines.filter((line) => line.trim() !== "");
  return filled.length > 0 && filled.every(isTemplateLine);
};
