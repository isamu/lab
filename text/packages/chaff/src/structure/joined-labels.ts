import type { NumberedLine } from "../plugin.ts";

/** "(4)(A)(i)" is as many labels as one line joins. */
const MAX_JOINED = 4;

/**
 * "(c)(1) Whenever…", "(4)(A)(i) In order…": a US statute opens a subsection and its first paragraph on one line. A label
 * at the start of the rest that the language reads (`read`, given what is open by then) as an item one level deeper is
 * opened (`open`) under the one before. Returns the innermost unit the line opened, whose rest is the line's text.
 */
export const openJoinedLabels = (
  first: NumberedLine | undefined,
  read: (rest: string) => NumberedLine | undefined,
  open: (inner: NumberedLine) => void,
): NumberedLine | undefined => {
  let current = first;
  for (let count = 0; current !== undefined && count < MAX_JOINED && current.rest.startsWith("("); count += 1) {
    const inner = read(current.rest);
    if (inner?.kind !== "item" || inner.depth <= current.depth) return current;
    open(inner);
    current = inner;
  }
  return current;
};
