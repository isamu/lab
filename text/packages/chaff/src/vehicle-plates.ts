// A vehicle's plate written two ways in one document (ひばり野 330 ね 48-15 and 48-75). Pure: reads the document's text; the
// labels come from the reference-label lexicon and the plate's shapes from the vehicle-plate lexicon, each a pattern whose
// named parts are the plate's parts. The part named serial is the one a slip changes; the others must be the same.
import type { LexiconEntry } from "./plugin.ts";
import { escapeRegExp } from "./orthography.ts";
import { withoutUrls } from "./phone-numbers.ts";
import type { ReferenceNumber } from "./reference-numbers.ts";
import { boundedMatches } from "./custom/bounded-match.ts";

/**
 * A plate as written, in its shape's group. fixed is its parts but the serial; opensSentence whether its label opens its
 * sentence (no word before it says whose plate it is, as 代車の does); onField whether its line holds only the label and the
 * plate (登録番号：ひばり野 330 ね 48-15), the vehicle the document is about.
 */
export type VehiclePlate = ReferenceNumber & {
  readonly fixed: string;
  readonly serial: string;
  readonly opensSentence: boolean;
  readonly onField: boolean;
};

/** A plate that is the document's own with one character of its serial changed, and the document's own plate. */
export type PlateVariant = { readonly number: VehiclePlate; readonly other: VehiclePlate };

type LabelHit = { readonly start: number; readonly end: number };

const SERIAL_PART = "serial";
const PART_JOIN = "\u0000";
const PLATE_GAP = /[\s\-‐−－・･.]/gu;
/** Only spaces and a colon, comma or opening bracket between a label and its plate, and nothing alphanumeric right after it. */
const BEFORE_PLATE = String.raw`^([\s:：,，、#＃(（「『[［]{0,4})`;
const PLATE_END = String.raw`(?![0-9０-９A-Za-zＡ-Ｚａ-ｚ\-‐−－])`;
const SENTENCE_END = /[。！？!?]|\.(?=\s)/u;
const LATIN_START = /^[a-z]/u;
const LETTER = /\p{Script=Latin}/u;
const FLAGS = "u";

/** Every place a label is written; a Latin label only as a whole word. */
const labelHits = (text: string, labels: readonly LexiconEntry[]): LabelHit[] => {
  const lowered = text.toLowerCase();
  const isWhole = (label: string, at: number): boolean =>
    !LATIN_START.test(label) || (!LETTER.test(lowered[at - 1] ?? "") && !LETTER.test(lowered[at + label.length] ?? ""));
  return labels.flatMap((entry) => {
    const label = entry.pattern.toLowerCase();
    if (label === "") return [];
    return [...lowered.matchAll(new RegExp(escapeRegExp(label), "gu"))]
      .filter((match) => isWhole(label, match.index))
      .map((match) => ({ start: match.index, end: match.index + label.length }));
  });
};

const lineEnd = (text: string, offset: number): number => {
  const end = text.indexOf("\n", offset);
  return end === -1 ? text.length : end;
};

const plateCharacters = (written: string): string => written.normalize("NFKC").replaceAll(PLATE_GAP, "").toUpperCase();

/** The parts of a plate but its serial, each evened out, so two plates of one vehicle's region, class and kana meet. */
const fixedParts = (parts: Record<string, string | undefined>): string =>
  Object.entries(parts)
    .flatMap(([name, part]) => (name === SERIAL_PART || part === undefined ? [] : [plateCharacters(part)]))
    .join(PART_JOIN);

/** A shape's pattern read right after a label, or nothing when it is not a valid expression. */
const compiledShape = (entry: LexiconEntry): RegExp | undefined => {
  try {
    return new RegExp(`${BEFORE_PLATE}(?:${entry.pattern})${PLATE_END}`, FLAGS);
  } catch {
    return undefined;
  }
};

/** The plate a shape matched right after a label: matched is the label's separators and the plate. */
const plateOf = (text: string, label: LabelHit, matched: string, shape: RegExp, group: string): VehiclePlate | undefined => {
  const match = shape.exec(matched);
  const serial = match?.groups?.[SERIAL_PART];
  if (match === null || match.groups === undefined || serial === undefined) return undefined;
  const offset = label.end + (match[1] ?? "").length;
  const written = matched.slice((match[1] ?? "").length);
  const lineStart = text.lastIndexOf("\n", label.start - 1) + 1;
  const head = text.slice(lineStart, label.start);
  const opensSentence = (head.split(SENTENCE_END).at(-1) ?? "").trim() === "";
  const onField = head.trim() === "" && text.slice(offset + written.length, lineEnd(text, offset)).trim() === "";
  return {
    offset,
    written,
    characters: plateCharacters(written),
    label: group,
    fixed: fixedParts(match.groups),
    serial: plateCharacters(serial),
    opensSentence,
    onField,
  };
};

/**
 * What one shape reads right after each label, in the labels' order. A shape comes from a lexicon a team may write, so it is
 * matched with a time limit (boundedMatches), and one that is not a valid expression reads nothing.
 */
const readsOfShape = (text: string, hits: readonly LabelHit[], afters: readonly string[], entry: LexiconEntry): (VehiclePlate | undefined)[] => {
  const shape = compiledShape(entry);
  if (shape === undefined) return hits.map(() => undefined);
  const matches = boundedMatches(shape.source, FLAGS, afters);
  return hits.map((hit, index) => {
    const matched = matches[index]?.[0];
    return matched?.index === 0 ? plateOf(text, hit, matched.text, shape, entry.group ?? entry.pattern) : undefined;
  });
};

/** The plates of a text, each right after a reference label in one of the plate shapes (the first that reads one wins). */
export const labelledPlates = (source: string, labels: readonly LexiconEntry[], shapeEntries: readonly LexiconEntry[]): VehiclePlate[] => {
  if (shapeEntries.length === 0) return [];
  const text = withoutUrls(source);
  // The longest label is read last, so the plate after 自動車登録番号 is read with it, not with 登録番号 inside it.
  const hits = labelHits(text, labels).toSorted((a, b) => a.end - a.start - (b.end - b.start));
  if (hits.length === 0) return [];
  const afters = hits.map((hit) => text.slice(hit.end, lineEnd(text, hit.end)));
  const readsByShape = shapeEntries.map((entry) => readsOfShape(text, hits, afters, entry));
  const plates = hits.flatMap((_, index) => readsByShape.map((reads) => reads[index]).find((plate) => plate !== undefined) ?? []);
  return [...new Map(plates.map((plate) => [plate.offset, plate])).values()].toSorted((a, b) => a.offset - b.offset);
};

/** Whether two serials of one length differ in one character only. */
const oneCharacterApart = (a: string, b: string): boolean => a.length === b.length && [...a].filter((character, index) => character !== b[index]).length === 1;

/**
 * The writings of a plate that is the document's own with one character of its serial changed (48-15 and 48-75), the rest
 * of the plate the same. Only when the document names one vehicle: its plate on a field line, one other plate and no third,
 * the other never on a field line and its label always opening the sentence. Two different numbers one character apart are
 * common, so nothing else is read.
 */
export const plateVariants = (plates: readonly VehiclePlate[]): PlateVariant[] => {
  const distinct = new Set(plates.map((plate) => `${plate.label}${PART_JOIN}${plate.characters}`));
  const fields = plates.filter((plate) => plate.onField);
  const own = fields[0];
  if (distinct.size !== 2 || own === undefined || fields.some((field) => field.characters !== own.characters)) return [];
  const others = plates.filter((plate) => plate.characters !== own.characters);
  const other = others[0];
  if (other === undefined || other.label !== own.label || other.fixed !== own.fixed || !oneCharacterApart(other.serial, own.serial)) return [];
  return others.every((plate) => plate.opensSentence) ? others.map((number) => ({ number, other: own })) : [];
};
