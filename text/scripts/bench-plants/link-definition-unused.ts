// A seeded link definition no link uses, for `yarn bench`: a "[label]: URL" line added at the end of the sample.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { codeLines, linesOf, type Mutation, type Plant } from "../bench-text.ts";

const DEFINITION = "[unused-form]: https://example.com/form";

/** Appends a definition after a blank line, unless the sample ends inside a code block. */
const unusedDefinition = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  if (codeLines(lines).has(lines.length - 1)) return undefined;
  const kept = lines.slice(0, lines.findLastIndex((line) => line.trim() !== "") + 1);
  return { source: [...kept, "", DEFINITION, ""].join("\n"), line: kept.length + 2 };
};

export const MUTATIONS: readonly Mutation[] = [
  { id: "link-definition-unused", rule: "link-definition-unused", languages: ["ja", "en"], plant: unusedDefinition },
];
