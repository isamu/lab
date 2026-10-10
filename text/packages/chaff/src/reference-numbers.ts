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
const REFERENCE_SHAPE = /(?<![A-Za-z0-9Ａ-Ｚａ-ｚ０-９\-‐−－])[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]+(?:[-‐−－][A-Za-z0-9Ａ-Ｚａ-ｚ０-９]+)*/gu;
/** Digits enough that a swap is a slip in one number, not two short codes (A-12, B-21). */
const MIN_DIGITS = 4;
const MAX_CHARACTERS = 24;
const DIGIT = /\d/gu;
const SEPARATOR = /[-‐−－]/gu;
/** Only spaces and a colon, comma or opening bracket between the label and its number (「予約番号：」, "booking number, "); not a sentence's end. */
const LABEL_TO_NUMBER = /^[\s:：,，、#＃(（「『[［]{0,4}$/u;

const charactersOf = (written: string): string => written.normalize("NFKC").replaceAll(SEPARATOR, "").toUpperCase();

/** The reference numbers of a text written right after a label on their line; unlabelled codes and URLs are not read. */
export const labelledReferenceNumbers = (source: string, labels: readonly LexiconEntry[]): ReferenceNumber[] => {
  const text = withoutUrls(source);
  return [...text.matchAll(REFERENCE_SHAPE)].flatMap((match) => {
    const characters = charactersOf(match[0]);
    if ((characters.match(DIGIT)?.length ?? 0) < MIN_DIGITS || characters.length > MAX_CHARACTERS) return [];
    const label = labelBefore(text, match.index, labels);
    if (label === undefined || !LABEL_TO_NUMBER.test(label.between)) return [];
    return [{ offset: match.index, written: match[0], characters, label: label.group }];
  });
};

/** Every writing of a reference number that is another of the same label with two neighbours swapped (swappedVariants). */
export const referenceVariants = (numbers: readonly ReferenceNumber[]): ReferenceVariant[] => swappedVariants(numbers, (number) => number.characters);
