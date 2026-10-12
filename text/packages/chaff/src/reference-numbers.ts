// A document's own reference number (a booking or confirmation number) written two ways: the same letters and digits with
// two neighbours swapped (MN-48215 and MN-48251), both right after a label of the same kind. Pure: reads the document's text;
// the labels (予約番号, Booking number) come from the language's reference-label lexicon, grouped by what they label.
import type { LexiconEntry } from "./plugin.ts";
import { labelBefore, swappedVariants, withoutUrls } from "./phone-numbers.ts";

/** A reference number as written, where it is, its letters and digits without separators, and its label's group. */
export type ReferenceNumber = { readonly offset: number; readonly written: string; readonly characters: string; readonly label: string };

/** A reference number that is another of the same label with two neighbours swapped, and that other number. */
export type ReferenceVariant = { readonly number: ReferenceNumber; readonly other: ReferenceNumber };

/** Letters and digits, half or full width, joined by hyphens (MN-48215, AR730514, ＭＮ－４８２１５). */
export const REFERENCE_SHAPE = /(?<![A-Za-z0-9Ａ-Ｚａ-ｚ０-９\-‐−－])[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]+(?:[-‐−－][A-Za-z0-9Ａ-Ｚａ-ｚ０-９]+)*/gu;
/** Digits enough that a swap is a slip in one number, not two short codes (A-12, B-21). */
export const MIN_DIGITS = 4;
export const MAX_CHARACTERS = 24;
const DIGIT = /\d/gu;
const SEPARATOR = /[-‐−－]/gu;
/** Only spaces and a colon, comma or opening bracket between the label and its number (「予約番号：」, "booking number, "); not a sentence's end. */
const LABEL_TO_NUMBER = /^[\s:：,，、#＃(（「『[［]{0,4}$/u;

export const charactersOf = (written: string): string => written.normalize("NFKC").replaceAll(SEPARATOR, "").replaceAll(" ", "").toUpperCase();

/** A first group a number in groups may open with: capitals and digits only (HM, 5520), not a word (No, Member). */
const OPENING_GROUP = /^[0-9A-Z０-９Ａ-Ｚ]+$/u;
/** One space, then four or more capitals and digits holding a digit, not run on into a word (8137 の; not 100 copies, 080, 2名, 2nd). */
const FOLLOWING_GROUP = /^ (?=[0-9A-Z０-９Ａ-Ｚ]*[0-9０-９])[0-9A-Z０-９Ａ-Ｚ]{4,}(?![\p{L}\p{N}\-‐−－](?<!\p{Script=Hiragana}))/u;

/** The groups after a number's first, written one space apart on its line (HM 5520 8137); none when the first is not a group. Reading stops once past the longest number, so a run-on is still too long. */
export const followingGroups = (text: string, end: number, first: string): string => {
  if (!OPENING_GROUP.test(first)) return "";
  const read = (at: number, sofar: string): string => {
    const tooLong = charactersOf(first + sofar).length > MAX_CHARACTERS;
    const group = tooLong ? undefined : FOLLOWING_GROUP.exec(text.slice(at, at + MAX_CHARACTERS + 1))?.[0];
    return group === undefined ? sofar : read(at + group.length, sofar + group);
  };
  return read(end, "");
};

/** The reference numbers of a text written right after a label on their line; unlabelled codes and URLs are not read. */
export const labelledReferenceNumbers = (source: string, labels: readonly LexiconEntry[]): ReferenceNumber[] => {
  const text = withoutUrls(source);
  return [...text.matchAll(REFERENCE_SHAPE)].flatMap((match) => {
    const written = match[0] + followingGroups(text, match.index + match[0].length, match[0]);
    const characters = charactersOf(written);
    if ((characters.match(DIGIT)?.length ?? 0) < MIN_DIGITS || characters.length > MAX_CHARACTERS) return [];
    const label = labelBefore(text, match.index, labels);
    if (label === undefined || !LABEL_TO_NUMBER.test(label.between)) return [];
    return [{ offset: match.index, written, characters, label: label.group }];
  });
};

/** Every writing of a reference number that is another of the same label with two neighbours swapped (swappedVariants). */
export const referenceVariants = (numbers: readonly ReferenceNumber[]): ReferenceVariant[] => swappedVariants(numbers, (number) => number.characters);
