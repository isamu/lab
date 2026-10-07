// The same label on the screen written two ways in one manual (**Start Restore** and **Start restore**, ［復元を開始］ and
// ［復元開始］). Pure: reads the labels a manual marks as labels, bold or in ［］, and points at the form written less often.

import { escapeRegExp } from "./orthography.ts";

export type Label = { readonly surface: string; readonly offset: number };
export type LabelVariant = { readonly label: Label; readonly usual: string };

/** What a manual marks as a label on the screen: bold (** or __), or the full-width brackets Japanese manuals use. */
const MARKED = /\*\*([^*\n]{1,40})\*\*|__([^_\n]{1,40})__|［([^］\n]{1,40})］/gu;
const SPACES = /\s+/gu;
const LETTER = /\p{L}/u;

/** Each label marked in the source whose text is prose (not covered as code in prose) and holds a letter. */
export const labelsIn = (source: string, prose: string): Label[] =>
  [...source.matchAll(MARKED)].flatMap((match) => {
    const surface = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    const inner = match.index + match[0].indexOf(surface);
    const covered = prose.slice(inner, inner + surface.length) !== surface;
    return covered || !LETTER.test(surface) ? [] : [{ surface, offset: inner }];
  });

/**
 * Two forms of one label differ only in case, spaces, or a word a label is written with or without (the label-particle
 * lexicon: 復元を開始 and 復元開始).
 */
const keyOf = (surface: string, particles: readonly string[]): string =>
  particles.reduce((text, particle) => text.replace(joining(particle), ""), surface.replace(SPACES, "")).toLowerCase();

/** A particle between two kanji or katakana (復元を開始), not one inside a word (その他). */
const joining = (particle: string): RegExp =>
  new RegExp(`(?<=[\\p{Script=Han}\\p{Script=Katakana}ー])${escapeRegExp(particle)}(?=[\\p{Script=Han}\\p{Script=Katakana}])`, "gu");

/** Two forms that differ only in the case of their first letter (Note and note): emphasis at a sentence's start, not two labels. */
const onlyFirstLetterDiffers = (forms: readonly string[]): boolean =>
  new Set(forms.map((form) => `${form.charAt(0).toLowerCase()}${form.slice(1)}`)).size === 1;

const groupBy = (labels: readonly Label[], keyFor: (label: Label) => string): Map<string, Label[]> =>
  labels.reduce((groups, label) => groups.set(keyFor(label), [...(groups.get(keyFor(label)) ?? []), label]), new Map<string, Label[]>());

/**
 * Each label written in a form other than the one its key is written in most; on a tie, the later form. A label written
 * one way only says nothing.
 */
export const labelVariants = (labels: readonly Label[], particles: readonly string[] = []): LabelVariant[] => {
  const byKey = groupBy(labels, (label) => keyOf(label.surface, particles));
  return [...byKey.values()].flatMap((group) => {
    const counts = groupBy(group, (label) => label.surface);
    if (counts.size < 2 || onlyFirstLetterDiffers([...counts.keys()])) return [];
    const [first] = counts;
    if (first === undefined) return [];
    const usual = [...counts].reduce((best, entry) => (entry[1].length > best[1].length ? entry : best), first)[0];
    return group.filter((label) => label.surface !== usual).map((label) => ({ label, usual }));
  });
};
