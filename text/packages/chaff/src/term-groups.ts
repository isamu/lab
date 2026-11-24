import type { LexiconEntry, Span } from "./plugin.ts";
import { escapeRegExp } from "./orthography.ts";

// The team's groups of words that are each right but must not be mixed (chaff.yaml consistent: [[顧客, お客様], [log in,
// sign in]]): where the text writes a member, and, within one text, which members are the minority. Pure.

/** A group's members, in the order chaff.yaml lists them. */
export type TermGroup = readonly string[];

/** One written member: its group (by position in chaff.yaml), the member as listed, and where it is written. */
export type GroupHit = { readonly group: number; readonly member: string; readonly span: Span };

/** The groups as the word list carries them: one entry per member, its group's position in `group`. */
export const groupsOfLexicon = (lexicon: readonly LexiconEntry[]): TermGroup[] => {
  const byGroup = new Map<string, string[]>();
  lexicon.forEach((entry) => {
    if (entry.group === undefined) return;
    byGroup.set(entry.group, [...(byGroup.get(entry.group) ?? []), entry.pattern]);
  });
  return [...byGroup.values()];
};

/** A Latin letter or digit: a member that starts or ends with one is a word, and a match inside a longer word is not it. */
const WORD_CHAR = /[\p{Script=Latin}\p{N}_]/u;

const isWordEdge = (text: string, span: Span, member: string): boolean => {
  const before = WORD_CHAR.test(member.charAt(0)) && WORD_CHAR.test(text.charAt(span.start - 1));
  const after = WORD_CHAR.test(member.charAt(member.length - 1)) && WORD_CHAR.test(text.charAt(span.end));
  return !before && !after;
};

/** A member as written, in any case: a sentence or a title capitalises "Log in" without choosing another word. */
const memberHits = (text: string, group: number, member: string): GroupHit[] =>
  [...text.matchAll(new RegExp(escapeRegExp(member), "giu"))]
    .map((match) => ({ group, member, span: { start: match.index, end: match.index + match[0].length } }))
    .filter((hit) => isWordEdge(text, hit.span, member));

const isInsideLonger = (hit: GroupHit, other: GroupHit): boolean =>
  other.span.end - other.span.start > hit.span.end - hit.span.start && other.span.start <= hit.span.start && hit.span.end <= other.span.end;

/** Every member written in the text, in order. A member inside a longer one written there (申込 inside 申し込み) is part of the longer. */
export const groupHits = (text: string, groups: readonly TermGroup[]): GroupHit[] => {
  const found = groups.flatMap((members, group) => members.flatMap((member) => memberHits(text, group, member)));
  return found.filter((hit) => !found.some((other) => isInsideLonger(hit, other))).toSorted((left, right) => left.span.start - right.span.start);
};

/** What one group comes to in one text: nothing (one member or none), the minority places, or a tie between the most used members. */
export type GroupVerdict<T extends GroupHit> =
  | { readonly kind: "minority"; readonly usual: string; readonly usualCount: number; readonly odd: readonly T[] }
  | { readonly kind: "tie"; readonly members: readonly { readonly member: string; readonly count: number }[]; readonly first: T };

const countsOf = <T extends GroupHit>(hits: readonly T[]): Map<string, number> =>
  hits.reduce((counts, hit) => counts.set(hit.member, (counts.get(hit.member) ?? 0) + 1), new Map<string, number>());

/**
 * One group's hits in one text. With one member used there is nothing to say. With one member used most, the places of the
 * others are the minority. When two or more share the most, neither side is taken: one verdict names every member used.
 */
export const groupVerdict = <T extends GroupHit>(hits: readonly T[]): GroupVerdict<T> | undefined => {
  const counts = countsOf(hits);
  const first = hits[0];
  if (counts.size < 2 || first === undefined) return undefined;
  const top = Math.max(...counts.values());
  const leaders = [...counts].filter(([, count]) => count === top).map(([member]) => member);
  const [usual] = leaders;
  if (leaders.length > 1 || usual === undefined) return { kind: "tie", members: [...counts].map(([member, count]) => ({ member, count })), first };
  return { kind: "minority", usual, usualCount: top, odd: hits.filter((hit) => hit.member !== usual) };
};
