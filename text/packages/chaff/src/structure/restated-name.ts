import type { StructureNode } from "../plugin.ts";

// The name an inline definition follows: Financial Crimes Enforcement Network ("FinCEN"). A letter defines its
// abbreviation in the subject line and again at first use, and a quoted title of another letter carries its own; the
// same name before the same term restates one definition, so the two cannot disagree. Pure.

/** Small words a name may hold between its capitalised words (Department of the Treasury, Office on Violence Against Women). */
const NAME_JOINTS: ReadonlySet<string> = new Set(["of", "the", "and", "for", "on", "in", "at", "to", "&"]);
const CAPITALISED = /^\p{Lu}/u;
/** Fewer capitalised words than this is a word, not a name (the Company). */
const MIN_NAME_WORDS = 2;

const isNameWord = (word: string): boolean => CAPITALISED.test(word) || NAME_JOINTS.has(word);

/**
 * The capitalised name written right before an inline definition on its line, or undefined when there is none: a lower-
 * case word before the bracket (a Delaware corporation (the "Company")) names nothing that could be restated.
 */
export const nameBeforeDefinition = (source: string, node: StructureNode): string | undefined => {
  if (node.attrs["placement"] !== "inline") return undefined;
  const lineStart = source.lastIndexOf("\n", node.span.start - 1) + 1;
  const words = source.slice(lineStart, node.span.start).trim().split(/\s+/u);
  const run = words.slice(words.findLastIndex((word) => !isNameWord(word)) + 1);
  const firstCapital = run.findIndex((word) => CAPITALISED.test(word));
  const name = firstCapital === -1 ? [] : run.slice(firstCapital);
  const capitalised = name.filter((word) => CAPITALISED.test(word)).length;
  return capitalised >= MIN_NAME_WORDS && CAPITALISED.test(name.at(-1) ?? "") ? name.join(" ") : undefined;
};
