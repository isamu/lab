// Seeded bold line in place of a heading, for `yarn bench`: a section heading after the first one, with text under it, is
// rewritten as a bold line on its own. Pure and deterministic, like scripts/bench-mutations.ts.
import { codeLines, linesOf, replaceLine, type Mutation, type Plant } from "../bench-text.ts";

const HEADING = /^#{2,6} (?<words>\S.*)$/u;

/** Words a heading ends in when it is a sentence or a lead-in, which pseudo-heading leaves alone. */
const CLOSING_PUNCTUATION = /[.,;:!?。，；：！？、]$/u;

/** Whether a body line, not a heading, comes after the blank line under the line at `index`. */
const bodyFollows = (lines: readonly string[], index: number): boolean => {
  const next = lines.slice(index + 1).find((line) => line.trim() !== "");
  return next !== undefined && !next.startsWith("#");
};

/** The words of a section heading that a bold line can stand in for: no marks of its own, no closing punctuation. */
const plantableWords = (line: string): string | undefined => {
  const words = HEADING.exec(line)?.groups?.["words"]?.trim();
  return words === undefined || /[*:#]/u.test(words) || CLOSING_PUNCTUATION.test(words) ? undefined : words;
};

/** 二つ目より後ろの、本文の付いた見出しを、太字の一行にする。 */
const boldHeading = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const code = codeLines(lines);
  const headings = lines.flatMap((line, at) => (!code.has(at) && HEADING.test(line) ? [at] : []));
  const target = headings.slice(1).find((at) => bodyFollows(lines, at) && plantableWords(lines[at] ?? "") !== undefined);
  const words = target === undefined ? undefined : plantableWords(lines[target] ?? "");
  return target === undefined || words === undefined ? undefined : { source: replaceLine(lines, target, `**${words}**`), line: target + 1 };
};

export const MUTATIONS: readonly Mutation[] = [{ id: "heading-set-in-bold", rule: "pseudo-heading", languages: ["ja", "en"], plant: boldHeading }];
