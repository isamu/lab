import { codeFences } from "../detectors/code-fences.ts";

const FENCE_MARK = /`{3}|~{3}/u;

const NONE: ReadonlySet<number> = new Set();

/** The index of the line holding an offset of the joined lines. */
const lineIndexAt = (starts: readonly number[], offset: number): number => starts.findLastIndex((start) => start <= offset);

/**
 * The indexes of the lines of fenced code blocks (``` or ~~~), the fences included. A table or a list written in one is an
 * example, not the document's own values. The blocks are the ones the Markdown parser reads (code-fences.ts): a fence in
 * a list item is one, a line indented as code or a fence in a quotation is not, and an unclosed fence runs to the end.
 */
export const fencedLineIndexes = (texts: readonly string[]): ReadonlySet<number> => {
  if (!texts.some((text) => FENCE_MARK.test(text))) return NONE;
  const starts: number[] = [];
  texts.reduce((start, text) => {
    starts.push(start);
    return start + text.length + 1;
  }, 0);
  const fenced = new Set<number>();
  codeFences(texts.join("\n")).forEach((fence) => {
    const last = lineIndexAt(starts, Math.max(fence.start, fence.end - 1));
    for (let index = lineIndexAt(starts, fence.start); index <= last; index += 1) fenced.add(index);
  });
  return fenced;
};
