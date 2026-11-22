// How the rules that compare files decide which file is out of step: each file votes with the one value it writes for an
// item (a spelling, a price, a definition), and the files outside the value most files write are the ones reported.
// Pure. chaff takes no side on which value is right; the fewer side is where to look, and with no fewer side, every side.

/** One file's value for one item. */
export type Vote<T> = { readonly path: string; readonly value: T };

/** The votes for the value most files write, and the votes for any other value, in the run's order. */
export type Tally<T> = { readonly usual: readonly Vote<T>[]; readonly odd: readonly Vote<T>[]; readonly values: number };

type Votes<T> = readonly [Vote<T>, ...Vote<T>[]];

/** A vote to report, and the votes of the value it is compared with. */
export type OutOfStep<T> = { readonly vote: Vote<T>; readonly against: Votes<T> };

/** The votes grouped by value, each group in the order its first vote came. */
const groupsOf = <T>(votes: readonly Vote<T>[], same: (left: T, right: T) => boolean): [Vote<T>, ...Vote<T>[]][] =>
  votes.reduce<[Vote<T>, ...Vote<T>[]][]>((groups, vote) => {
    const home = groups.find((group) => same(group[0].value, vote.value));
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

/** The values most files write: one when a value leads, two or more when they share the most files. */
const leadersOf = <T>(groups: readonly Votes<T>[]): Votes<T>[] => {
  const most = Math.max(...groups.map((group) => group.length));
  return groups.filter((group) => group.length === most);
};

/** What a value is compared with: the first leader, or for a leader, the leader after it (the last wraps to the first). */
const rivalOf = <T>(group: Votes<T>, leaders: readonly Votes<T>[]): Votes<T> | undefined => {
  const at = leaders.indexOf(group);
  return at === -1 ? leaders[0] : leaders[(at + 1) % leaders.length];
};

/**
 * The votes to report, value by value in the run's order. When one value leads, the votes of every other value, compared
 * with it. When two or more values share the most files, none is the usual one and every vote is reported, a leader's
 * compared with another leader: the order of the files in the run does not decide which side is pointed at.
 */
export const votesOutOfStep = <T>(votes: readonly Vote<T>[], same: (left: T, right: T) => boolean): OutOfStep<T>[] => {
  const groups = groupsOf(votes, same);
  const leaders = leadersOf(groups);
  return groups.flatMap((group) => {
    const rival = rivalOf(group, leaders);
    return rival === undefined || rival === group ? [] : group.map((vote) => ({ vote, against: rival }));
  });
};
