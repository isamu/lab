import { tallyVotes, type Vote } from "../cross-votes.ts";

// One term defined in two files of one run, in different words. Pure: the definitions come in already read from each file.

/** A definition as a file writes it: the term, what follows it up to the end of the sentence, and where it is. */
export type WrittenDefinition = { readonly term: string; readonly body: string; readonly offset: number };

export type FileDefinitions = { readonly path: string; readonly definitions: readonly WrittenDefinition[] };

/** A file that defines a term unlike most files that define it, and one file of the usual wording. */
export type DefinitionOutOfStep = {
  readonly path: string;
  readonly definition: WrittenDefinition;
  readonly usual: Vote<WrittenDefinition>;
  readonly files: number;
};

/** Marks that do not change what a definition says: spaces, and the punctuation at its two ends. */
const EDGE = /^[\s、，,:：]+|[\s。．.]+$/gu;
const SPACE = /\s+/gu;

/** The wording compared: width, spaces and the punctuation at the ends evened out. */
export const definitionKey = (body: string): string => body.normalize("NFKC").replace(EDGE, "").replace(SPACE, " ").trim();

/** A file's vote for a term: its first definition of it (a second one in the same file is duplicate-definition's). */
const voteOf = (file: FileDefinitions, term: string): Vote<WrittenDefinition>[] => {
  const first = file.definitions.find((definition) => definition.term === term && definitionKey(definition.body) !== "");
  return first === undefined ? [] : [{ path: file.path, value: first }];
};

const sameWording = (left: WrittenDefinition, right: WrittenDefinition): boolean => definitionKey(left.body) === definitionKey(right.body);

/** The files that define a term in other words than most files of the run that define it. */
export const definitionsOutOfStep = (files: readonly FileDefinitions[]): DefinitionOutOfStep[] => {
  const terms = [...new Set(files.flatMap((file) => file.definitions.map((definition) => definition.term)))];
  return terms.flatMap((term) => {
    const tally = tallyVotes(
      files.flatMap((file) => voteOf(file, term)),
      sameWording,
    );
    const [usual] = tally?.usual ?? [];
    if (tally === undefined || usual === undefined) return [];
    return tally.odd.map((vote) => ({ path: vote.path, definition: vote.value, usual, files: tally.usual.length }));
  });
};
