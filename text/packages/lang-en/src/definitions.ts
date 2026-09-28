import type { Mention } from "chaffjs/plugin";
import { CHAPTER_DEPTH, PART_DEPTH } from "./depth.ts";

// Definitions in English documents, and how far a definition holds.

const DEFINITIONS = [
  /["“](?<term>[^"”\n]{1,60})["”] (?:means|shall mean|refers to|has the meaning)\b/gu,
  /\((?:the |hereinafter )?["“](?<term>[^"”\n]{1,60})["”]\)/gu,
  /\(hereinafter referred to as ["“](?<term>[^"”\n]{1,60})["”]\)/gu,
];

/**
 * "In this Part—" and "This section applies where a person ("the seller")…": a statute defines the same word again
 * in the next Part. A Part's definitions are compared within the Part, a section's within the section.
 */
const DEFINITION_SCOPE = /\b(?:In this (?:section|subsection|Part|Chapter|Schedule|Article)\b|This (?:section|Part|Chapter) defines\b)/u;
/** "This section applies where a person ("the seller") …" names a party in parentheses for this section only. */
const APPLIES = /\bThis section applies\b/u;
/** "In this Part" and "This Part defines" hold in the Part; "In this Chapter" in the Chapter; the rest in the section. */
const WIDER_SCOPE: readonly (readonly [RegExp, number])[] = [
  [/\b(?:In this|This) Part\b/u, PART_DEPTH],
  [/\b(?:In this|This) Chapter\b/u, CHAPTER_DEPTH],
];

export const opensDefinitionScope = (text: string): boolean => DEFINITION_SCOPE.test(text);

export const definitionScopeDepth = (text: string): number | undefined =>
  DEFINITION_SCOPE.test(text) ? WIDER_SCOPE.find(([pattern]) => pattern.test(text))?.[1] : undefined;

/** "has the meaning given in section 3" points at a definition elsewhere instead of making one. */
const POINTER = /^ has the meaning given (?:in|by)\b/u;
const isPointer = (text: string, end: number): boolean => POINTER.test(text.slice(end - " has the meaning".length));

export const definitions = (text: string): Mention[] =>
  DEFINITIONS.flatMap((pattern) =>
    [...text.matchAll(pattern)].flatMap((match) => {
      const term = match.groups?.["term"];
      if (term === undefined) return [];
      const end = match.index + match[0].length;
      const namesAParty = match[0].startsWith("(") && APPLIES.test(text);
      return [{ start: match.index, end, attrs: { term, ...(isPointer(text, end) || namesAParty ? { scope: "local" } : {}) } }];
    }),
  );
