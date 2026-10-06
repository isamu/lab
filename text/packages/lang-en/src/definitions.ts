import type { Mention } from "chaffjs/plugin";
import { CHAPTER_DEPTH, PART_DEPTH } from "./depth.ts";

// Definitions in English documents, and how far a definition holds.

const DEFINITIONS = [
  /["“](?<term>[^"”\n]{1,60})["”] (?:means|shall mean|refers to|has the meaning)\b/gu,
  /\((?:the |these |this |hereinafter |each,? an? |collectively,? the )?["“](?<term>[^"”\n]{1,60})["”]\)/gu,
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

/** ("Seller") has no word that says it defines: the same parentheses quote an example ("silently fails"). */
const BARE = /^\(["“]/u;

/**
 * A bracket that gives one thing several names: ("Pinecone", "we" or "us"), (the "Company", "we", "us", or "our"). The
 * first name is the inline definition (it follows the long name); the others are defined there too.
 */
const BRACKET = /\((?<inside>[^()\n]{1,300})\)/gu;
const QUOTED_NAME = /["“](?<term>[^"”\n]{1,60})["”]/gu;
/** What may come before the first name: (the "Company", (each, a "Party", (collectively, the "Parties". */
const LIST_LEAD = /^(?:the |collectively,? the |each,? an? )?$/u;
/** What may come between two names: a comma, and or or, and the. */
const LIST_JOINT = /^(?:, (?:and |or )?| and | or )(?:the )?$/u;
/** A list of names starts with a capitalised one ("Pinecone"); ("mine", "not mine", "yours") quotes examples. */
const CAPITALISED = /^\p{Lu}/u;

type QuotedName = { readonly term: string; readonly start: number; readonly end: number };

/** The quoted names of a bracket that holds nothing but two or more names, joined as a list; otherwise none. */
const namesInList = (inside: string): QuotedName[] => {
  const names = [...inside.matchAll(QUOTED_NAME)].map((match) => ({
    term: match.groups?.["term"] ?? "",
    start: match.index,
    end: match.index + match[0].length,
  }));
  const [first] = names;
  if (first === undefined || names.length < 2 || !CAPITALISED.test(first.term) || !LIST_LEAD.test(inside.slice(0, first.start))) return [];
  const joined = names.slice(1).every((name, index) => LIST_JOINT.test(inside.slice(names[index]?.end ?? 0, name.start)));
  return joined && inside.slice(names.at(-1)?.end ?? 0) === "" ? names : [];
};

/**
 * A bracket that gives one thing several names: ("Pinecone", "we" or "us"), (the "Company", "we", "us", or "our"). The
 * first name is the inline definition (it follows the long name); the others are defined there too.
 */
const nameListDefinitions = (text: string): Mention[] =>
  [...text.matchAll(BRACKET)].flatMap((match) => {
    const inside = match.groups?.["inside"] ?? "";
    const bare = BARE.test(match[0]) ? { form: "bare" } : {};
    const scope = APPLIES.test(text) ? { scope: "local" } : {};
    return namesInList(inside).map((name, index) => {
      const start = index === 0 ? match.index : match.index + 1 + name.start;
      const end = index === 0 ? match.index + match[0].length : match.index + 1 + name.end;
      return { start, end, attrs: { term: name.term, ...scope, ...(index === 0 ? { placement: "inline" } : {}), ...bare } };
    });
  });

const patternDefinitions = (text: string): Mention[] =>
  DEFINITIONS.flatMap((pattern) =>
    [...text.matchAll(pattern)].flatMap((match) => {
      const term = match.groups?.["term"];
      if (term === undefined) return [];
      const end = match.index + match[0].length;
      const inline = match[0].startsWith("(");
      const namesAParty = inline && APPLIES.test(text);
      const scope = isPointer(text, end) || namesAParty ? { scope: "local" } : {};
      const bare = BARE.test(match[0]) ? { form: "bare" } : {};
      return [{ start: match.index, end, attrs: { term, ...scope, ...(inline ? { placement: "inline" } : {}), ...bare } }];
    }),
  );

export const definitions = (text: string): Mention[] =>
  [...patternDefinitions(text), ...nameListDefinitions(text)].toSorted((left, right) => left.start - right.start);
