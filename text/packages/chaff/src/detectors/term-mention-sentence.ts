import { escapeRegExp } from "../orthography.ts";
import type { Sentence } from "../plugin.ts";

// An entry of a definitions list opens with the term it defines, in quotes ("Capital Contributions" The capital
// contribution to the Venture …). The words after the quoted name are the definition's own body, not uses of the term.
// Pure.

/** The ending a quoted name may carry past the term: a plural or a possessive (Contributions, Contribution's). */
const ENDING = String.raw`(?:e?s|['’]s)?`;
/** The label of a list item before the entry (a., (b), 1., iv)). */
const ITEM_LABEL = String.raw`(?:\(?[\p{L}\p{N}]{1,4}[.)]\s+)?`;
/** The quotes a term is named in, each with its own closing mark. */
const QUOTE_PAIRS = [
  ['"', '"'],
  ["“", "”"],
  ["「", "」"],
  ["『", "』"],
] as const;

const entryHead = (term: string): RegExp => {
  const quoted = QUOTE_PAIRS.map(([open, close]) => `${open}${escapeRegExp(term)}${ENDING}${close}`).join("|");
  return new RegExp(`^\\s*${ITEM_LABEL}(?:${quoted})`, "u");
};

/** Whether the sentence holding offset is a definitions entry that opens with the term in quotes, and offset is after that name. */
export const inEntryOfTerm = (sentences: readonly Sentence[], term: string, offset: number): boolean => {
  const sentence = sentences.find((candidate) => candidate.span.start <= offset && offset < candidate.span.end);
  if (sentence === undefined) return false;
  const head = entryHead(term).exec(sentence.text);
  return head !== null && offset - sentence.span.start >= head[0].length;
};
