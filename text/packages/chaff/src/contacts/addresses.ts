// Postal addresses written two ways in one document: the same street with its block numbers swapped or one of them changed
// (丸の内二丁目4番1号 and 丸の内二丁目1番4号, 2-4-1 and 2-1-4 Marunouchi), or the same street and numbers under two postcodes.
// Only an address with a label shortly before it on its line is read (住所, 本店所在地, Address, head office); the labels come
// from the language's address-label lexicon, grouped by whose address they name, so a head office and a branch are never
// compared. Pure.
import type { LexiconEntry } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { writingVariants, type Variant, type Writing } from "./variants.ts";

/** An address as written: the street it is on and the area written with it (東京都千代田区, Chiyoda-ku), its block numbers, its postcode when the line has one, and its label's group. */
export type AddressWriting = Writing & {
  readonly street: string;
  readonly area: string;
  readonly numbers: readonly number[];
  readonly postcode: string | undefined;
  readonly label: string;
};

/** A group that names no one office (住所, Address) and so may be compared with any. */
const ANY_OFFICE = "address";
const KANA_HAN = String.raw`\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}ー々ヶ`;
const BLOCK_JOIN = String.raw`\s?(?:丁目|番地|番|号|の|[-‐−－])\s?`;
/** A Japanese street (its town, ward, city) and its block numbers: 東京都千代田区丸の内二丁目4番1号, 梅田1-2-3. */
const JA_ADDRESS = new RegExp(String.raw`([${KANA_HAN}]{2,40}?)([0-9０-９]{1,4}(?:${BLOCK_JOIN}[0-9０-９]{1,4}){1,3})(?:\s?(?:号|番地|番))?`, "gu");
/** Block numbers, the capitalised street after them and the area after a comma: 2-4-1 Marunouchi, Chiyoda-ku; 120 Main Street, Springfield. */
const EN_BLOCK = String.raw`(?<![\w.\-/])(\d{1,5}(?:-\d{1,5}){0,3})`;
const EN_STREET = String.raw`([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,3})`;
const EN_AREA = String.raw`(?:,\s?([A-Z][A-Za-z]*(?:-[a-z]+)?))?`;
const EN_ADDRESS = new RegExp(String.raw`${EN_BLOCK}\s+${EN_STREET}${EN_AREA}`, "gu");
/** 都道府県, 市, 区 and 郡: what comes after the last of them in a Japanese street is the town the numbers count in. */
const DIVISIONS = [..."都道府県市区郡"];
const CHOME = "丁目";
const KANJI_NUMERALS = "一二三四五六七八九十";
const KANJI_DIGITS = "一二三四五六七八九";
const JP_POSTCODE = /(?<![\d\-‐−－])〒?\s?(\d{3})[-‐−－](\d{4})(?![\d\-‐−－])/u;
const US_ZIP = /\b[A-Z]{2}\s(\d{5})(?:-\d{4})?\b/u;
const JP_POSTCODE_ONLY = /^\d{3}-\d{4}$/u;
const YEAR = /^(?:19|20)\d{2}$/u;
const FULL_WIDTH_DIGIT = /[０-９]/gu;
const NUMBER = /\d+/gu;
const LATIN_START = /^[A-Za-z]/u;
const LETTER = /\p{L}/u;
/** How far before an address its label may end: 「本店所在地（」, "head office at ". */
const MAX_LABEL_GAP = 20;
const MIN_STREET_LENGTH = 2;

/** 一 to 九十九 as a number; the 丁目 of a Japanese street. */
const kanjiNumber = (kanji: string): number => {
  const digit = (char: string): number => KANJI_DIGITS.indexOf(char) + 1;
  if (!kanji.includes("十")) return digit(kanji);
  const [tens = "", ones = ""] = kanji.split("十");
  return (tens === "" ? 1 : digit(tens)) * 10 + (ones === "" ? 0 : digit(ones));
};

const halfWidth = (text: string): string => text.replaceAll(FULL_WIDTH_DIGIT, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
const numbersOf = (text: string): number[] => [...halfWidth(text).matchAll(NUMBER)].map((match) => Number(match[0]));

/** The 二丁目 a street ends with, or "" when it ends with none. */
const chomeOf = (street: string): string => {
  if (!street.endsWith(CHOME)) return "";
  const numeral = Array.from(street.slice(0, -CHOME.length))
    .toReversed()
    .findIndex((char) => !KANJI_NUMERALS.includes(char));
  const length = numeral === -1 ? street.length - CHOME.length : numeral;
  return length === 0 ? "" : street.slice(street.length - CHOME.length - length);
};

/** The town of a Japanese street as written (丸の内二丁目), its name without the 丁目 and the 丁目 as a number; undefined when the street names no ward, city or prefecture. */
const jaStreet = (run: string): { area: string; written: string; town: string; chome: number[] } | undefined => {
  const lastDivision = Math.max(...DIVISIONS.map((division) => run.lastIndexOf(division)));
  if (lastDivision < 0) return undefined;
  const written = run.slice(lastDivision + 1);
  const chome = chomeOf(written);
  const town = written.slice(0, written.length - chome.length);
  const numbered = chome === "" ? [] : [kanjiNumber(chome.slice(0, -CHOME.length))];
  return town.length < MIN_STREET_LENGTH ? undefined : { area: run.slice(0, lastDivision + 1), written, town, chome: numbered };
};

type Place = { readonly offset: number; readonly written: string; readonly street: string; readonly area: string; readonly numbers: number[] };

const jaPlaces = (text: string): Place[] =>
  [...text.matchAll(JA_ADDRESS)].flatMap((match) => {
    const run = match[1] ?? "";
    const street = jaStreet(run);
    if (street === undefined) return [];
    const townStart = run.length - street.written.length;
    return [
      {
        offset: match.index + townStart,
        written: match[0].slice(townStart),
        street: street.town,
        area: street.area,
        numbers: [...street.chome, ...numbersOf(match[2] ?? "")],
      },
    ];
  });

/** A lone number before capitalised words is an address only when a comma goes on to the area (120 Main Street, Springfield), not a count (365 Plan). */
const isAddressBlock = (block: string, area: string): boolean => block.includes("-") || area !== "";

const enPlaces = (text: string): Place[] =>
  [...text.matchAll(EN_ADDRESS)].flatMap((match) => {
    const [, block = "", street = "", area = ""] = match;
    if (JP_POSTCODE_ONLY.test(block) || YEAR.test(block) || !isAddressBlock(block, area)) return [];
    return [{ offset: match.index, written: `${block} ${street}`, street: street.toLowerCase(), area: area.toLowerCase(), numbers: numbersOf(block) }];
  });

/** Where a label last occurs before an address on its line; a Latin label only as a whole word (office, not officer). */
const lastPlace = (before: string, label: string): number => {
  const lowered = label.toLowerCase();
  const places = [...before.matchAll(new RegExp(escapeRegExp(lowered), "gu"))].map((match) => match.index);
  const whole = LATIN_START.test(label) ? places.filter((at) => !LETTER.test(before[at - 1] ?? "") && !LETTER.test(before[at + lowered.length] ?? "")) : places;
  return whole.at(-1) ?? -1;
};

/** The group of the label ending nearest before an address on its line, the longest when two end together (本店所在地 over 所在地). */
const labelBefore = (before: string, labels: readonly LexiconEntry[]): string | undefined =>
  labels
    .map((entry) => {
      const at = lastPlace(before, entry.pattern);
      return { group: entry.group ?? ANY_OFFICE, at, end: at + entry.pattern.length };
    })
    .filter((hit) => hit.at >= 0 && before.length - hit.end <= MAX_LABEL_GAP)
    .toSorted((a, b) => b.end - a.end || a.at - b.at)[0]?.group;

const postcodeOf = (line: string): string | undefined => {
  const japanese = JP_POSTCODE.exec(line);
  if (japanese !== null) return `${japanese[1] ?? ""}-${japanese[2] ?? ""}`;
  return US_ZIP.exec(line)?.[1];
};

/** The labelled addresses of one line; its postcode is given to an address only when the line holds one address. */
const lineAddresses = (line: string, start: number, labels: readonly LexiconEntry[]): AddressWriting[] => {
  const places = [...jaPlaces(line), ...enPlaces(line)];
  const postcode = places.length === 1 ? postcodeOf(line) : undefined;
  return places.flatMap((place) => {
    const label = labelBefore(line.slice(0, place.offset).toLowerCase(), labels);
    if (label === undefined) return [];
    const key = `${place.street}\u0000${place.numbers.join("-")}`;
    return [{ ...place, offset: start + place.offset, key, postcode, label }];
  });
};

/** The postal addresses of a text that have a label shortly before them on their line. */
export const labelledAddresses = (text: string, labels: readonly LexiconEntry[]): AddressWriting[] => {
  const lines = text.split("\n");
  const starts = lines.reduce<number[]>((acc, line, index) => [...acc, index === 0 ? 0 : (acc[index - 1] ?? 0) + (lines[index - 1] ?? "").length + 1], []);
  return lines.flatMap((line, index) => lineAddresses(line, starts[index] ?? 0, labels));
};

/** Two lists of block numbers that are one address mistyped: the same numbers in another order, or one of them changed. */
export const isBlockSlip = (a: readonly number[], b: readonly number[]): boolean => {
  if (a.length !== b.length || a.join("-") === b.join("-")) return false;
  const sorted = (numbers: readonly number[]): string => numbers.toSorted((x, y) => x - y).join("-");
  const differing = a.filter((number, index) => number !== b[index]).length;
  return sorted(a) === sorted(b) || differing === 1;
};

/** Whether two writings are on one street: the same town or street name, in the same area where both write one (千代田区 within 東京都千代田区). */
const sameStreet = (a: AddressWriting, b: AddressWriting): boolean => a.street === b.street && (a.area.endsWith(b.area) || b.area.endsWith(a.area));

const sameOffice = (a: AddressWriting, b: AddressWriting): boolean => a.label === b.label || a.label === ANY_OFFICE || b.label === ANY_OFFICE;

export type AddressVariant = { readonly variant: "address" | "postcode"; readonly found: Variant<AddressWriting> };

/** Every writing of an address that is another of the same street with its numbers mistyped, or under another postcode. */
export const addressVariants = (text: string, labels: readonly LexiconEntry[]): AddressVariant[] => {
  const addresses = labelledAddresses(text, labels);
  const numbered = writingVariants(addresses, (a, b) => sameStreet(a, b) && sameOffice(a, b) && isBlockSlip(a.numbers, b.numbers));
  const withPostcode = addresses.flatMap((address) => (address.postcode === undefined ? [] : [{ ...address, key: `${address.key}\u0000${address.postcode}` }]));
  const postcoded = writingVariants(
    withPostcode,
    (a, b) => sameStreet(a, b) && a.numbers.join("-") === b.numbers.join("-") && a.postcode !== b.postcode && sameOffice(a, b),
  );
  const tagged =
    (variant: AddressVariant["variant"]) =>
    (found: Variant<AddressWriting>): AddressVariant => ({ variant, found });
  return [...numbered.map(tagged("address")), ...postcoded.map(tagged("postcode"))];
};
