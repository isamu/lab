// How the rules that compare files decide which file is out of step: each file votes with the one value it writes for an
// item (a spelling, a price, a definition), and the files outside the value most files write are the ones reported.
// Pure. chaff takes no side on which value is right; the fewer side is where to look.

/** One file's value for one item. */
export type Vote<T> = { readonly path: string; readonly value: T };

/** The votes for the value most files write, and the votes for any other value, in the run's order. */
export type Tally<T> = { readonly usual: readonly Vote<T>[]; readonly odd: readonly Vote<T>[]; readonly values: number };

/** The votes grouped by value, each group in the order its first vote came. */
const groupsOf = <T>(votes: readonly Vote<T>[], same: (left: T, right: T) => boolean): Vote<T>[][] =>
  votes.reduce<Vote<T>[][]>((groups, vote) => {
    const home = groups.find((group) => group[0] !== undefined && same(group[0].value, vote.value));
    if (home === undefined) groups.push([vote]);
    else home.push(vote);
    return groups;
  }, []);

/**
 * The votes split by value. The usual value is the one most files write; on a tie, the one whose first file comes first in
 * the run's order. values: how many different values the files write. undefined when no file votes.
 */
export const tallyVotes = <T>(votes: readonly Vote<T>[], same: (left: T, right: T) => boolean): Tally<T> | undefined => {
  const groups = groupsOf(votes, same);
  const usual = groups.reduce<Vote<T>[] | undefined>((best, group) => (best === undefined || group.length > best.length ? group : best), undefined);
  if (usual === undefined) return undefined;
  return { usual, odd: votes.filter((vote) => !usual.includes(vote)), values: groups.length };
};
