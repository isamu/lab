// Seeded mistakes of Markdown markup for `yarn bench`: a heading that skips a level, an image with no alt text, a link to a
// heading the document does not have, and a URL with text run on after it. Pure and deterministic, like
// scripts/bench-mutations.ts.
import { codeLines, linesOf, replaceLine, type Plant } from "./bench-text.ts";

const HEADING = /^(#{1,6})\s/u;

const depthOf = (line: string): number | undefined => HEADING.exec(line)?.[1]?.length;

/** Markdown の見出しの深さの上限。 */
const DEEPEST = 6;

type Heading = { readonly index: number; readonly depth: number };

const headingsOf = (lines: readonly string[]): Heading[] => {
  const code = codeLines(lines);
  return lines.flatMap((line, index) => {
    const depth = depthOf(line);
    return depth === undefined || code.has(index) ? [] : [{ index, depth }];
  });
};

// --- heading-level-skip ---

/** 前の見出しと同じか浅い見出しを、前の見出しの二段下にする。文字を小さく見せたくて深さを選んだ見出し。 */
export const skipHeadingLevel = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const headings = headingsOf(lines);
  const target = headings.find((heading, at) => {
    const previous = headings[at - 1];
    return previous !== undefined && heading.depth <= previous.depth && previous.depth + 2 <= DEEPEST;
  });
  const previous = target === undefined ? undefined : headings[headings.indexOf(target) - 1];
  const line = target === undefined ? undefined : lines[target.index];
  if (target === undefined || previous === undefined || line === undefined) return undefined;
  return { source: replaceLine(lines, target.index, line.replace(HEADING, `${"#".repeat(previous.depth + 2)} `)), line: target.index + 1 };
};
