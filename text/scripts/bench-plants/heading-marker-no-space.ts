// Seeded heading marks with no space after them, for `yarn bench`: the first second-level heading whose words open with a
// letter loses the space after its marks (## 手順 becomes ##手順). Pure and deterministic, like scripts/bench-mutations.ts.
import { codeLines, linesOf, replaceLine, type Mutation, type Plant } from "../bench-text.ts";

const SPACED_HEADING = /^(?<marks>#{2,6}) +(?=\p{L})/u;

/** ## の後ろの空白を抜いて、見出しにならない行にする。 */
const unspacedMarks = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const code = codeLines(lines);
  const index = lines.findIndex((line, at) => !code.has(at) && SPACED_HEADING.test(line));
  const line = lines[index];
  return line === undefined ? undefined : { source: replaceLine(lines, index, line.replace(SPACED_HEADING, "$<marks>")), line: index + 1 };
};

export const MUTATIONS: readonly Mutation[] = [
  { id: "heading-marks-unspaced", rule: "heading-marker-no-space", languages: ["ja", "en"], plant: unspacedMarks },
];
