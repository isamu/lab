import { comparable, sameValue, type FactValue } from "./fact-values.ts";
import type { ScopedFact } from "./fact-scope.ts";
import { tallyVotes, type Vote } from "../cross-votes.ts";

// The same labelled fact given different values in different files of one run ("Monthly fee: $12" in one page, "$15" in
// another). Pure: the facts come in already read from each file. Within a file, fact-conflict compares section by section.

/** A file's labelled facts, by its path. */
export type FileFacts = { readonly path: string; readonly facts: readonly ScopedFact[] };

/** A file whose value for a label differs from the value most files give it: its first fact, and one file of the usual value. */
export type FactOutOfStep = { readonly path: string; readonly fact: ScopedFact; readonly usual: Vote<ScopedFact>; readonly files: number };

/** Two values the files can be said to agree or disagree on: comparable, and the same. */
const sameFact = (left: ScopedFact, right: ScopedFact): boolean => sameValue(left.value, right.value);

/**
 * A file's vote for a label: its first fact, when every fact of the label in the file gives the same value. A file giving
 * the label two values is either a list (a fee per plan) or a conflict within the file, which fact-conflict reports.
 */
const voteOf = (file: FileFacts, key: string): Vote<ScopedFact>[] => {
  const facts = file.facts.filter((fact) => fact.key === key && !fact.record);
  const [first] = facts;
  if (first === undefined) return [];
  return facts.every((fact) => comparable(first.value, fact.value) && sameFact(first, fact)) ? [{ path: file.path, value: first }] : [];
};

/** The votes split into groups whose values can be compared at all (one unit, overlapping date precision). */
const comparableGroups = (votes: readonly Vote<ScopedFact>[]): Vote<ScopedFact>[][] =>
  votes.reduce<Vote<ScopedFact>[][]>((groups, vote) => {
    const home = groups.find((group) => group[0] !== undefined && comparable(group[0].value.value, vote.value.value));
    if (home === undefined) groups.push([vote]);
    else home.push(vote);
    return groups;
  }, []);

/** Two values across the files, as with fact-conflict in one section: three or more is read as a list, and left alone. */
const MAX_VALUES = 2;

const outOfStep = (votes: readonly Vote<ScopedFact>[]): FactOutOfStep[] => {
  const tally = tallyVotes(votes, sameFact);
  const [usual] = tally?.usual ?? [];
  if (tally === undefined || usual === undefined || tally.values !== MAX_VALUES) return [];
  return tally.odd.map((vote) => ({ path: vote.path, fact: vote.value, usual, files: tally.usual.length }));
};

/** The files whose value for a label differs from the value most files of the run give it. */
export const factsOutOfStep = (files: readonly FileFacts[]): FactOutOfStep[] => {
  const keys = [...new Set(files.flatMap((file) => file.facts.map((fact) => fact.key)))];
  return keys.flatMap((key) => comparableGroups(files.flatMap((file) => voteOf(file, key))).flatMap(outOfStep));
};

/** The value as written, for a message. */
export const writtenValue = (source: string, value: FactValue): string => source.slice(value.start, value.end);
