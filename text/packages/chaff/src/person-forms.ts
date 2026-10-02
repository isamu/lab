import type { Lexicon } from "./plugin.ts";
import { isWithinAny, QUOTATION_MARKS, quotedSpans } from "./quoted-span.ts";

// The party a document names (私たち / 弊社 for itself, you / one for its reader). Each place is read as a form that fills
// a slot, so a document naming one slot two ways can be pointed at its minority. Which form is right is never decided.

/** One place that names a party: where it is in the text, as written, the form it counts as and the slot it fills. */
export type PersonMention = { readonly at: number; readonly written: string; readonly form: string; readonly slot: string };

/** From the language package: person-word (surface → form), person-form (form → slot), person-not-after (a word before that makes a form another word; a package may have none). */
export type PersonWords = { readonly words: Lexicon; readonly forms: Lexicon; readonly notAfter: Lexicon };

/**
 * A neighbour that makes the hit part of a longer word: a Latin letter or digit, a combining mark, a kanji, a katakana
 * (東京本社, 当社比, yourselves). Hiragana is not one: 私は is 私 and a particle.
 */
const JOINING = /[\p{Script=Latin}\p{N}\p{M}\p{Script=Han}\p{Script=Katakana}ー]/u;

const LATIN_WORD = /^[\p{Script=Latin}']+$/u;

/** How far back the word before is looked for. A longer word than this is not one person-not-after lists. */
const BEFORE_REACH = 24;

/** Lower case for ASCII letters only, so every position in the text stays where it was (toLowerCase can change length: İ). */
const asciiLower = (text: string): string => text.replace(/[A-Z]/gu, (letter) => letter.toLowerCase());

type Pattern = { readonly text: string; readonly form: string; readonly slot: string };

const builtPatterns = new WeakMap<PersonWords, readonly Pattern[]>();

/** Longest first, so 私たち is read before 私. A surface whose form names no slot is not read. Built once per word set. */
const patternsOf = (person: PersonWords): readonly Pattern[] => {
  const built = builtPatterns.get(person);
  if (built !== undefined) return built;
  const slots = new Map(person.forms.map((entry) => [entry.pattern, entry.instead_of ?? entry.pattern]));
  const patterns = person.words
    .flatMap((entry) => {
      const form = entry.instead_of ?? entry.pattern;
      const slot = slots.get(form);
      return slot === undefined ? [] : [{ text: asciiLower(entry.pattern), form, slot }];
    })
    .toSorted((left, right) => right.text.length - left.text.length);
  builtPatterns.set(person, patterns);
  return patterns;
};

/** The word right before a hit, with only spaces between: "for, one can" has none, "for one" has "for". */
const wordBefore = (text: string, at: number): string => {
  const reach = text.slice(Math.max(0, at - BEFORE_REACH), at);
  const trimmed = reach.trimEnd();
  const last = trimmed.split(/\s/u).at(-1) ?? "";
  return trimmed.length === reach.length || !LATIN_WORD.test(last) ? "" : asciiLower(last);
};

/** Written in capitals (YOU in a shouted heading) it is not the running text's habit. */
const isCapitals = (written: string): boolean => written.length > 1 && written === written.toUpperCase() && written !== written.toLowerCase();

/** person-not-after's instead_of is the form an entry guards; without it, every form. */
const guards = (entry: Lexicon[number], form: string, before: string): boolean =>
  asciiLower(entry.pattern) === before && (entry.instead_of === undefined || entry.instead_of === form);

const standsAlone = (text: string, start: number, end: number, form: string, person: PersonWords): boolean => {
  if (JOINING.test(text.charAt(start - 1)) || JOINING.test(text.charAt(end))) return false;
  if (isCapitals(text.slice(start, end))) return false;
  const before = wordBefore(text, start);
  return before === "" || !person.notAfter.some((entry) => guards(entry, form, before));
};

/** Every start of `needle` in `haystack`. A loop, so a text with thousands of hits does not grow the stack. */
const startsOf = (haystack: string, needle: string): number[] => {
  const found: number[] = [];
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) found.push(at);
  return found;
};

/** Pure: every place the text names a party, outside quotations (「」『』“”""), in order. Case is ignored. */
export const personMentions = (text: string, person: PersonWords): PersonMention[] => {
  const quoted = quotedSpans(text, QUOTATION_MARKS);
  const lower = asciiLower(text);
  const taken = new Uint8Array(text.length);
  const found: PersonMention[] = [];
  patternsOf(person).forEach((pattern) => {
    startsOf(lower, pattern.text).forEach((start) => {
      const end = start + pattern.text.length;
      if (taken.subarray(start, end).some((mark) => mark === 1)) return;
      if (isWithinAny(quoted, { start, end }) || !standsAlone(text, start, end, pattern.form, person)) return;
      taken.fill(1, start, end);
      found.push({ at: start, written: text.slice(start, end), form: pattern.form, slot: pattern.slot });
    });
  });
  return found.toSorted((left, right) => left.at - right.at);
};

export type PersonMinority<T> = { readonly odd: readonly T[]; readonly usual: string; readonly of: number };

/** Fewer than this many places name the slot the usual way, and there is no habit to go against. */
const MIN_USUAL = 3;
const PERCENT = 100;

/** The most used form; on a tie, the one the document used first (a Map keeps first-use order). */
const usualForm = (forms: readonly string[]): string | undefined => {
  const counts = new Map<string, number>();
  forms.forEach((form) => counts.set(form, (counts.get(form) ?? 0) + 1));
  return [...counts.entries()].reduce<[string, number] | undefined>((best, next) => (best === undefined || next[1] > best[1] ? next : best), undefined)?.[0];
};

/**
 * Pure: for each slot, the places that use another form than the document's usual one. Entries are in document order.
 * Nothing when the slot has one form, when the usual form has fewer than MIN_USUAL places, or when the other forms pass
 * limitPercent of the slot's places: then the document uses two forms on purpose, and pointing at either takes a side.
 */
export const personMinorities = <T extends { readonly mention: PersonMention }>(entries: readonly T[], limitPercent: number): PersonMinority<T>[] =>
  [...new Set(entries.map((entry) => entry.mention.slot))].flatMap((slot) => {
    const inSlot = entries.filter((entry) => entry.mention.slot === slot);
    const usual = usualForm(inSlot.map((entry) => entry.mention.form));
    const odd = inSlot.filter((entry) => entry.mention.form !== usual);
    if (usual === undefined || odd.length === 0 || inSlot.length - odd.length < MIN_USUAL) return [];
    return odd.length * PERCENT > limitPercent * inSlot.length ? [] : [{ odd, usual, of: inSlot.length }];
  });
