import type { Atom } from "./atom.ts";

/** The same fact written another way: 1,000円 and 1000円, 2026年4月1日 and 2026/4/1, a reworded heading. */
export type Reformed = { readonly before: Atom; readonly after: Atom };

export type Comparison = {
  /** In the first document and not in the second. */
  readonly dropped: readonly Atom[];
  /** In the second document and not in the first. */
  readonly added: readonly Atom[];
  readonly reformed: readonly Reformed[];
};

export const identity = (atom: Atom): string => `${atom.kind}\u0000${atom.key}`;

const groupBy = <T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [item]);
    else group.push(item);
  });
  return groups;
};

/** Takes and removes the first item the queue for key holds. */
type Queues<T> = { readonly groups: Map<string, T[]>; readonly taken: Map<string, number> };

const queuesOf = <T>(items: readonly T[], keyOf: (item: T) => string): Queues<T> => ({ groups: groupBy(items, keyOf), taken: new Map() });

/** The next item not yet taken under key. A cursor, not shift(): shift moves every item left, which is quadratic over a long queue. */
const takeFrom = <T>(queues: Queues<T>, key: string): T | undefined => {
  const next = queues.taken.get(key) ?? 0;
  const item = queues.groups.get(key)?.[next];
  if (item !== undefined) queues.taken.set(key, next + 1);
  return item;
};

/** Atoms of one fact: written the same way they need no report; written differently they pair as reformed; the rest are surplus. */
const matchGroup = (before: readonly Atom[], after: readonly Atom[]): Comparison => {
  const afterByText = queuesOf(after, (atom) => atom.text);
  const sameText = new Set<Atom>();
  const unmatchedBefore = before.filter((atom) => {
    const twin = takeFrom(afterByText, atom.text);
    if (twin !== undefined) sameText.add(twin);
    return twin === undefined;
  });
  const unmatchedAfter = after.filter((atom) => !sameText.has(atom));
  const pairs = Math.min(unmatchedBefore.length, unmatchedAfter.length);
  return {
    reformed: unmatchedBefore.slice(0, pairs).map((atom, index) => ({ before: atom, after: unmatchedAfter[index] ?? atom })),
    dropped: unmatchedBefore.slice(pairs),
    added: unmatchedAfter.slice(pairs),
  };
};

const unitQueue = (value: string | undefined, unitless: boolean): string => `${value ?? ""}\u0000${unitless ? "bare" : "unit"}`;

/**
 * A number one side wrote with a unit the language package read (30 ＧＢ) and the other wrote so the unit was not read
 * (30GB) is one number in another form. Two different units (5 件, 5 人) stay a dropped and an added fact.
 */
const pairUnits = (comparison: Comparison): Comparison => {
  const addedNumbers = queuesOf(
    comparison.added.filter((atom) => atom.kind === "number"),
    (atom) => unitQueue(atom.value, atom.unitless === true),
  );
  const paired = new Set<Atom>();
  const reformed = comparison.dropped.flatMap((atom): Reformed[] => {
    // Two unitless numbers of one value share a key and were already paired; only the other side's kind can match.
    const found = atom.kind === "number" ? takeFrom(addedNumbers, unitQueue(atom.value, atom.unitless !== true)) : undefined;
    if (found === undefined) return [];
    paired.add(atom).add(found);
    return [{ before: atom, after: found }];
  });
  return {
    dropped: comparison.dropped.filter((atom) => !paired.has(atom)),
    added: comparison.added.filter((atom) => !paired.has(atom)),
    reformed: [...comparison.reformed, ...reformed],
  };
};

const byLine = (left: Atom, right: Atom): number => left.line - right.line;

/**
 * The facts of two documents compared as multisets: where a fact is written does not matter, how many times it is
 * stated does. Pure: the same atoms always give the same comparison.
 */
export const compareAtoms = (before: readonly Atom[], after: readonly Atom[]): Comparison => {
  const beforeGroups = groupBy(before, identity);
  const afterGroups = groupBy(after, identity);
  const keys = [...new Set([...beforeGroups.keys(), ...afterGroups.keys()])];
  const groups = keys.map((key) => matchGroup(beforeGroups.get(key) ?? [], afterGroups.get(key) ?? []));
  const paired = pairUnits({
    dropped: groups.flatMap((group) => group.dropped),
    added: groups.flatMap((group) => group.added),
    reformed: groups.flatMap((group) => group.reformed),
  });
  return {
    dropped: paired.dropped.toSorted(byLine),
    added: paired.added.toSorted(byLine),
    reformed: paired.reformed.toSorted((left, right) => byLine(left.before, right.before)),
  };
};
