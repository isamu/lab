// One phone number written two ways in a document: the same digits with two neighbours swapped (0120-123-456 and
// 0120-123-465), both after a label of the same kind. Pure: reads the document's text; the labels (電話, Phone, FAX) come
// from the language's phone-label lexicon, grouped by what they label, so a phone number and a fax number are never compared.
import type { LexiconEntry } from "./plugin.ts";
import { escapeRegExp } from "./orthography.ts";

/** A number as written, where it is, its digits and the group of the nearest label before it on its line. */
export type PhoneNumber = { readonly offset: number; readonly written: string; readonly digits: string; readonly label: string };

/** A number whose digits are another's with two neighbours swapped, and that other number. */
export type PhoneVariant = { readonly number: PhoneNumber; readonly other: PhoneNumber };

const MIN_DIGITS = 9;
const MAX_DIGITS = 13;
/** What joins two groups of digits: a hyphen, a closing bracket (with a space or hyphen after it) or an opening one. */
const GROUP_JOIN = String.raw`(?:[-‐−]|[)）][ \-‐−]?|[(（])`;
/** Not part of a longer number, a date's or an amount's digits. */
const NUMBER_EDGE_BEFORE = String.raw`(?<![\d,.\-‐−])`;
const NUMBER_EDGE_AFTER = String.raw`(?![\d\-‐−]|[.,]\d)`;
const COUNTRY_CODE = String.raw`(?:\+\d{1,3}[ -]?)?`;
/** Groups of digits joined by hyphens or brackets (03-1234-5678, 03（1234）5678, (555) 123-4567, +81-3-1234-5678). */
const NUMBER_SHAPE = new RegExp(String.raw`${NUMBER_EDGE_BEFORE}${COUNTRY_CODE}[(（]?\d{1,5}(?:${GROUP_JOIN}\d{1,5}){1,3}${NUMBER_EDGE_AFTER}`, "gu");
/**
 * Groups of digits joined by spaces (020 7946 0186, +44 20 7946 0186, 03 1234 5678). The last group has three digits or
 * more and no such group follows it, so a count after the number ("0186 24 hours") is left out and a run that does not
 * split one way only ("2026 10 09 020 7946 0186") is not read.
 */
const SPACED_SHAPE = new RegExp(
  String.raw`${NUMBER_EDGE_BEFORE}(?:\+\d{1,3}[ \u00A0])?\d{1,5}(?:[ \u00A0]\d{1,5}){0,2}[ \u00A0]\d{3,5}${NUMBER_EDGE_AFTER}(?![ \u00A0]\d{3})`,
  "gu",
);
/** Spaced digits are a phone number only with a country code, or right after their label: dates, amounts and ids are spaced too. */
const COUNTRY_CODE_START = /^\+/u;
const LABEL_TO_NUMBER = /^(?:[\s:：.．]|\uFE0F)*$/u;
const NOT_DIGIT = /\D/gu;
const LATIN_START = /^[A-Za-z]/u;
const LETTER = /\p{L}/u;
/** How far before a number its label may end: 「電話でのお問合せは、」, "by phone, call". */
const MAX_LABEL_GAP = 15;
const URL = /\b(?:https?:\/\/|www\.)\S+/giu;

/** Where a label last occurs in a line's text before a number; a Latin label only as a whole word (tel, not hotel). */
const lastPlace = (before: string, label: string): number => {
  const lowered = label.toLowerCase();
  const places = [...before.matchAll(new RegExp(escapeRegExp(lowered), "gu"))].map((match) => match.index);
  const whole = LATIN_START.test(label) ? places.filter((at) => !LETTER.test(before[at - 1] ?? "") && !LETTER.test(before[at + lowered.length] ?? "")) : places;
  return whole.at(-1) ?? -1;
};

type LabelBefore = { readonly group: string; readonly between: string };

/** The label ending nearest before a number on its line, the longest when two end together (携帯電話 over 電話), and what lies between. */
export const labelBefore = (text: string, offset: number, labels: readonly LexiconEntry[]): LabelBefore | undefined => {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const before = text.slice(lineStart, offset).toLowerCase();
  const nearest = labels
    .map((entry) => {
      const at = lastPlace(before, entry.pattern);
      return { group: entry.group ?? entry.pattern, at, end: at + entry.pattern.length };
    })
    .filter((hit) => hit.at >= 0 && before.length - hit.end <= MAX_LABEL_GAP)
    .toSorted((a, b) => b.end - a.end || a.at - b.at)[0];
  return nearest === undefined ? undefined : { group: nearest.group, between: before.slice(nearest.end) };
};

/** URLs covered with spaces, so neither a path segment (/call/) nor an id in one is read. Offsets stay the same. */
export const withoutUrls = (text: string): string => text.replaceAll(URL, (url) => " ".repeat(url.length));

/** The phone numbers of a text that have a label shortly before them on their line; unlabelled digits and URLs are not read. */
export const labelledPhoneNumbers = (source: string, labels: readonly LexiconEntry[]): PhoneNumber[] => {
  const text = withoutUrls(source);
  const read = (match: RegExpExecArray, spaced: boolean): PhoneNumber[] => {
    const digits = match[0].replaceAll(NOT_DIGIT, "");
    if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return [];
    const label = labelBefore(text, match.index, labels);
    if (label === undefined) return [];
    if (spaced && !COUNTRY_CODE_START.test(match[0]) && !LABEL_TO_NUMBER.test(label.between)) return [];
    return [{ offset: match.index, written: match[0].trim(), digits, label: label.group }];
  };
  return [
    ...[...text.matchAll(NUMBER_SHAPE)].flatMap((match) => read(match, false)),
    ...[...text.matchAll(SPACED_SHAPE)].flatMap((match) => read(match, true)),
  ].toSorted((a, b) => a.offset - b.offset);
};

/** Whether two strings (digits, or a reference number's letters and digits) are the same but for one pair of neighbours swapped. */
export const swapsNeighbours = (a: string, b: string): boolean => {
  if (a.length !== b.length || a === b) return false;
  const differ = [...a].flatMap((digit, index) => (digit === b[index] ? [] : [index]));
  const [first, second] = differ;
  return differ.length === 2 && first !== undefined && second === first + 1 && a[first] === b[second] && a[second] === b[first];
};

/** A labelled writing compared with the others of its label: where it is and the label's group. */
type LabelledWriting = { readonly offset: number; readonly label: string };

/**
 * Every writing that is another writing of the same label with two neighbouring characters swapped (characters is what is
 * compared): of the two, the one written fewer times, or the one first written later when both are written as often. Each
 * comes with the other writing.
 */
export const swappedVariants = <T extends LabelledWriting>(writtenAll: readonly T[], characters: (writing: T) => string): { number: T; other: T }[] => {
  const keyOf = (writing: T): string => `${writing.label}\u0000${characters(writing)}`;
  const writings = writtenAll.reduce((byKey, writing) => byKey.set(keyOf(writing), [...(byKey.get(keyOf(writing)) ?? []), writing]), new Map<string, T[]>());
  const timesOf = (writing: T): number => writings.get(keyOf(writing))?.length ?? 0;
  const firsts = [...writings.values()].flatMap((group) => group.slice(0, 1));
  const minorityOf = (a: T, b: T): T => {
    if (timesOf(a) !== timesOf(b)) return timesOf(a) < timesOf(b) ? a : b;
    return a.offset > b.offset ? a : b;
  };
  return firsts
    .flatMap((first, index) =>
      firsts.slice(index + 1).flatMap((second) => {
        if (first.label !== second.label || !swapsNeighbours(characters(first), characters(second))) return [];
        const minority = minorityOf(first, second);
        const other = minority === first ? second : first;
        return (writings.get(keyOf(minority)) ?? []).map((number) => ({ number, other }));
      }),
    )
    .toSorted((a, b) => a.number.offset - b.number.offset);
};

/** Every phone number that is another of the same label with two neighbouring digits swapped (swappedVariants). */
export const phoneVariants = (numbers: readonly PhoneNumber[]): PhoneVariant[] => swappedVariants(numbers, (number) => number.digits);
