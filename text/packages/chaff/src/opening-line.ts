import { plainSource } from "./plain-source.ts";

const FRONT_MATTER_FENCE = "---";
/** An ATX heading; four spaces of indent make it a code line instead. */
const HEADING = /^ {0,3}#{1,6}(?:\s|$)/u;

/** The lines after a leading front matter block. */
const bodyLines = (lines: readonly string[]): readonly string[] => {
  const close = lines[0] === FRONT_MATTER_FENCE ? lines.indexOf(FRONT_MATTER_FENCE, 1) : -1;
  return close === -1 ? lines : lines.slice(close + 1);
};

/** The line a document's body opens with (a letter's salutation), past front matter, blank lines and Markdown headings. */
export const openingLine = (source: string): string | undefined =>
  bodyLines(plainSource(source).split("\n"))
    .find((line) => line.trim() !== "" && !HEADING.test(line))
    ?.trim();
