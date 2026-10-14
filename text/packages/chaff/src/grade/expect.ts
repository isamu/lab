import type { Atom } from "../compare/atom.ts";
import { outcomeOf, type Compared } from "../compare/outcome.ts";

// An item's known answer (`expect`): facts the output must state and facts it must not. Pure: the shape of the field,
// which one fact an entry states, and whether the output states it, decided as `chaff compare --distinct` decides it.

export type GradeExpect = { readonly facts: readonly string[]; readonly absent: readonly string[] };

export const EXPECT_LISTS = ["facts", "absent"] as const;

export type ExpectList = (typeof EXPECT_LISTS)[number];

const isExpectList = (key: string): key is ExpectList => EXPECT_LISTS.some((list) => list === key);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isEntryList = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim() !== "");

/**
 * The field as written, or the path of its first wrong part. A key other than facts and absent is wrong, not ignored:
 * a misspelt list would check nothing and pass every output. A missing list is an empty one.
 */
export const expectOf = (raw: unknown): { readonly expect: GradeExpect | undefined } | { readonly wrong: string } => {
  if (raw === undefined) return { expect: undefined };
  if (!isRecord(raw)) return { wrong: "expect" };
  const unknown = Object.keys(raw).find((key) => !isExpectList(key));
  if (unknown !== undefined) return { wrong: `expect.${unknown}` };
  const wrongList = EXPECT_LISTS.find((list) => raw[list] !== undefined && !isEntryList(raw[list]));
  if (wrongList !== undefined) return { wrong: `expect.${wrongList}` };
  const listOf = (list: ExpectList): readonly string[] => {
    const value = raw[list];
    return isEntryList(value) ? value : [];
  };
  return { expect: { facts: listOf("facts"), absent: listOf("absent") } };
};

/** The one fact an entry states, or why it states none or several. */
export type EntryFact = { readonly fact: Atom } | { readonly unread: "no-fact" | "several-facts" };

/**
 * The fact an entry states. Several facts are one when exactly one of them is the whole entry: a quotation 「12,000円」
 * is read as the quotation and the number inside it, and the entry means the quotation.
 */
export const factOfEntry = (entry: string, atoms: readonly Atom[]): EntryFact => {
  const [only] = atoms;
  if (atoms.length === 1 && only !== undefined) return { fact: only };
  if (atoms.length === 0) return { unread: "no-fact" };
  const whole = atoms.filter((atom) => atom.text === entry.trim());
  const [wholeOnly] = whole;
  return whole.length === 1 && wholeOnly !== undefined ? { fact: wholeOnly } : { unread: "several-facts" };
};

/** Where an entry is in the item: `expect.facts[0]`. */
export const entryPath = (list: ExpectList, index: number): string => `expect.${list}[${String(index)}]`;

/** One entry as read: its list, its place, its text, and its document's facts with only the entry's fact kept. */
export type ReadEntry = { readonly list: ExpectList; readonly index: number; readonly entry: string; readonly read: Compared };

/** An entry that states one fact, compared as compare compares two documents: the output states it at least once. */
export const statesFact = (entry: Compared, output: Compared): boolean => outcomeOf(entry, output, undefined, "distinct").dropped.length === 0;

/** What the output was checked against: how many entries, the facts it does not state, and the absent ones it does. */
export type GradeExpectResult = { readonly checked: number; readonly missing: readonly string[]; readonly present: readonly string[] };

/** Each entry against the output, by the entry's text as written in the item. */
export const expectAgainst = (entries: readonly ReadEntry[], output: Compared): GradeExpectResult => ({
  checked: entries.length,
  missing: entries.filter((entry) => entry.list === "facts" && !statesFact(entry.read, output)).map((entry) => entry.entry),
  present: entries.filter((entry) => entry.list === "absent" && statesFact(entry.read, output)).map((entry) => entry.entry),
});

/** The failure reasons: `expect.missing 12,000円`, `expect.present 15,000円`. Absent when the item had no expect. */
export const expectFailures = (result: GradeExpectResult | undefined): string[] =>
  result === undefined ? [] : [...result.missing.map((entry) => `expect.missing ${entry}`), ...result.present.map((entry) => `expect.present ${entry}`)];
