import type { Atom } from "./atom.ts";
import type { Reformed } from "./match.ts";
import { isNearWord } from "../name-variants.ts";

/** The dropped and added facts left once the respelled names are paired off, and the pairs. */
export type Respelling = { readonly dropped: readonly Atom[]; readonly added: readonly Atom[]; readonly respelled: readonly Reformed[] };

const WORD_BREAK = /[\s-]+/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/** Whether text writes name as a whole name: "Aldo Piscitello" is not written inside "Aaldo Piscitello". */
export const writesName = (text: string, name: string): boolean => {
  for (let at = text.indexOf(name); at !== -1 && name !== ""; at = text.indexOf(name, at + 1)) {
    if (!LETTER_OR_DIGIT.test(text.charAt(at - 1)) && !LETTER_OR_DIGIT.test(text.charAt(at + name.length))) return true;
  }
  return false;
};

/** Borrowmoney and BorrowMoney: the same letters, another case. */
const isCaseOnly = (before: string, after: string): boolean => before !== after && before.toLowerCase() === after.toLowerCase();

/** One word of the name one letter apart (name-variant's near: Microsft and Microsoft), the other words the same. */
const isOneLetterOff = (before: string, after: string): boolean => {
  const [left, right] = [before.toLowerCase().split(WORD_BREAK), after.toLowerCase().split(WORD_BREAK)];
  if (left.length !== right.length) return false;
  const differing = left.flatMap((word, index): [string, string][] => (word === right[index] ? [] : [[word, right[index] ?? ""]]));
  const [only] = differing;
  return differing.length === 1 && only !== undefined && isNearWord(...only);
};

type Alike = (before: Atom, after: Atom, beforeText: string) => boolean;

const caseAlike: Alike = (before, after) => isCaseOnly(before.key, after.key);

/**
 * A one-letter change is a respelling only when the original already wrote the new spelling, which is what
 * name-variant asks for (unify on the spelling the document uses); otherwise Smith → Smyth may be another person.
 */
const letterAlike: Alike = (before, after, beforeText) => isOneLetterOff(before.key, after.key) && writesName(beforeText, after.key);

/** Whether after is before, a name, with its spelling corrected by either change. */
export const isRespelling = (before: Atom, after: Atom, beforeText: string): boolean =>
  before.kind === "name" && after.kind === "name" && [caseAlike, letterAlike].some((alike) => alike(before, after, beforeText));

const pairBy = (alike: Alike, start: Respelling, beforeText: string): Respelling => {
  const taken = new Set<Atom>();
  const respelled = start.dropped.flatMap((atom): Reformed[] => {
    const match = start.added.find((other) => !taken.has(other) && other.kind === "name" && atom.kind === "name" && alike(atom, other, beforeText));
    if (match === undefined) return [];
    taken.add(atom).add(match);
    return [{ before: atom, after: match }];
  });
  const left = (atoms: readonly Atom[]): Atom[] => atoms.filter((atom) => !taken.has(atom));
  return { dropped: left(start.dropped), added: left(start.added), respelled: [...start.respelled, ...respelled] };
};

/**
 * A dropped name and an added name that are one name with its spelling corrected, paired in line order: a change of
 * case first (no two names differ by case alone), then a one-letter change. They are reported as respelled, not as a
 * fact lost and a fact invented. beforeText is the original's prose (Extraction.nameText).
 */
export const pairRespelled = (dropped: readonly Atom[], added: readonly Atom[], beforeText: string): Respelling =>
  [caseAlike, letterAlike].reduce<Respelling>((paired, alike) => pairBy(alike, paired, beforeText), { dropped, added, respelled: [] });
