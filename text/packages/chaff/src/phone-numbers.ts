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

/** The group of the label ending nearest before a number on its line, the longest when two end together (携帯電話 over 電話). */
const labelBefore = (text: string, offset: number, labels: readonly LexiconEntry[]): string | undefined => {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const before = text.slice(lineStart, offset).toLowerCase();
  const nearest = labels
    .map((entry) => {
      const at = lastPlace(before, entry.pattern);
      return { group: entry.group ?? entry.pattern, at, end: at + entry.pattern.length };
    })
    .filter((hit) => hit.at >= 0 && before.length - hit.end <= MAX_LABEL_GAP)
    .toSorted((a, b) => b.end - a.end || a.at - b.at)[0];
  return nearest?.group;
};

/** URLs covered with spaces, so neither a path segment (/call/) nor an id in one is read. Offsets stay the same. */
const withoutUrls = (text: string): string => text.replaceAll(URL, (url) => " ".repeat(url.length));

/** The phone numbers of a text that have a label shortly before them on their line; unlabelled digits and URLs are not read. */
export const labelledPhoneNumbers = (source: string, labels: readonly LexiconEntry[]): PhoneNumber[] => {
  const text = withoutUrls(source);
  return [...text.matchAll(NUMBER_SHAPE)].flatMap((match) => {
    const digits = match[0].replaceAll(NOT_DIGIT, "");
    if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return [];
    const label = labelBefore(text, match.index, labels);
    return label === undefined ? [] : [{ offset: match.index, written: match[0].trim(), digits, label }];
  });
};

/** Whether two digit strings are the same but for one pair of neighbours swapped. */
export const swapsNeighbours = (a: string, b: string): boolean => {
  if (a.length !== b.length || a === b) return false;
  const differ = [...a].flatMap((digit, index) => (digit === b[index] ? [] : [index]));
  const [first, second] = differ;
  return differ.length === 2 && first !== undefined && second === first + 1 && a[first] === b[second] && a[second] === b[first];
};

const keyOf = (number: PhoneNumber): string => `${number.label}\u0000${number.digits}`;

/**
 * Every writing of a number that is another number of the same label with two neighbours swapped: of the two, the one
 * written fewer times, or the one first written later when both are written as often. Each comes with the other number.
 */
export const phoneVariants = (numbers: readonly PhoneNumber[]): PhoneVariant[] => {
  const writings = numbers.reduce((byKey, number) => byKey.set(keyOf(number), [...(byKey.get(keyOf(number)) ?? []), number]), new Map<string, PhoneNumber[]>());
  const timesOf = (number: PhoneNumber): number => writings.get(keyOf(number))?.length ?? 0;
  const firsts = [...writings.values()].flatMap((group) => group.slice(0, 1));
  const minorityOf = (a: PhoneNumber, b: PhoneNumber): PhoneNumber => {
    if (timesOf(a) !== timesOf(b)) return timesOf(a) < timesOf(b) ? a : b;
    return a.offset > b.offset ? a : b;
  };
  return firsts
    .flatMap((first, index) =>
      firsts.slice(index + 1).flatMap((second) => {
        if (first.label !== second.label || !swapsNeighbours(first.digits, second.digits)) return [];
        const minority = minorityOf(first, second);
        const other = minority === first ? second : first;
        return (writings.get(keyOf(minority)) ?? []).map((number) => ({ number, other }));
      }),
    )
    .toSorted((a, b) => a.number.offset - b.number.offset);
};
