// Seeded heading end marks for `yarn bench`: one heading among bare headings of its depth ends with a colon.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { codeLines, isJapanese, linesOf, replaceLine, type Mutation, type Plant } from "../bench-text.ts";

const HEADING = /^(#{2,6})\s+(\S.*)$/u;

/** A heading that already ends with a mark, or with a full stop of its words: the depth is not all bare. */
const ENDS_MARKED = /[:：.。]\s*$/u;

/** The rule needs this many headings of one depth before one of them is the odd one. */
const MIN_HEADINGS = 4;

type Heading = { readonly index: number; readonly depth: number; readonly text: string };

const headingsOf = (lines: readonly string[]): Heading[] => {
  const code = codeLines(lines);
  return lines.flatMap((line, index) => {
    const match = HEADING.exec(line);
    return match === null || code.has(index) ? [] : [{ index, depth: match[1]?.length ?? 0, text: match[2] ?? "" }];
  });
};

/** The third heading of the first depth whose headings number enough and all end bare. */
const target = (headings: readonly Heading[]): Heading | undefined => {
  const depths = [...new Set(headings.map((heading) => heading.depth))];
  const run = depths
    .map((depth) => headings.filter((heading) => heading.depth === depth))
    .find((same) => same.length >= MIN_HEADINGS && same.every((heading) => !ENDS_MARKED.test(heading.text)));
  return run?.[2];
};

/** Ends one heading with a colon in the width its language writes. */
const colonOnOne = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const heading = target(headingsOf(lines));
  if (heading === undefined) return undefined;
  const colon = isJapanese(heading.text) ? "：" : ":";
  return { source: replaceLine(lines, heading.index, `${"#".repeat(heading.depth)} ${heading.text.trimEnd()}${colon}`), line: heading.index + 1 };
};

export const MUTATIONS: readonly Mutation[] = [{ id: "heading-colon-one", rule: "heading-end-punctuation-mix", languages: ["ja", "en"], plant: colonOnOne }];
