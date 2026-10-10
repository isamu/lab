// range-band-mismatch: the bands of one table column or one list (7〜11歳, 12〜14歳, 15歳以上; under 7, 7 to 11, 12 and over)
// that overlap or leave a gap between neighbours. The words that bound a band and the units it is counted in come from the
// lexicons (range-band-word, range-band-unit, range-band-heading). Pure.

/** How an end of a band is written: 以上/以下 (inclusive), 未満/超 (exclusive), or only a range mark (7〜11, 7 to 11). */
export type BoundKind = "inclusive" | "exclusive" | "loose";

export type Bound = { readonly value: number; readonly kind: BoundKind; readonly decimals: number };

/** Integer units (ages, people, points) have no value between 11 and 12; continuous ones (kg, yen, hours) do. */
export type UnitKind = "integer" | "continuous";

export type Band = { readonly low: Bound | undefined; readonly high: Bound | undefined; readonly unit: string };

export type BandMarker = {
  readonly pattern: string;
  readonly side: "low" | "high";
  readonly kind: "inclusive" | "exclusive";
  readonly position: "before" | "after";
};

export type BandUnit = { readonly pattern: string; readonly kind: UnitKind; readonly position: "before" | "after" };

export type BandWords = {
  /** Marks between the two ends (〜, –, to). Written after a number alone (12歳〜) it leaves the band open above. */
  readonly connectors: readonly string[];
  /** The marks that, before a number alone (〜6歳), close a band above. A hyphen is not one: "- 5" is a bullet or a minus. */
  readonly openers: readonly string[];
  readonly markers: readonly BandMarker[];
  /** Words a band may open with that say nothing about its ends ("ages", "aged"). */
  readonly leads: readonly string[];
  readonly units: readonly BandUnit[];
  /** Column headings that name what bare numbers count (年齢, Age), with the kind of that quantity. */
  readonly headings: readonly { readonly pattern: string; readonly kind: UnitKind }[];
};

/** One band as written, with where it is. */
export type PlacedBand = { readonly band: Band; readonly start: number; readonly end: number; readonly text: string };

export type BandSlip = { readonly kind: "overlap" | "gap"; readonly earlier: PlacedBand; readonly later: PlacedBand };

const NUMBER = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/u;
const LATIN_END = /[a-z]$/u;
const LETTER = /^[a-z]/u;
const SPACE = /^\s*/u;
const EMPHASIS = /[*_`]/gu;

/** The text without a note in brackets at its end (15歳以上（成人）), and the note. */
const splitNote = (text: string): { readonly bare: string; readonly note: string | undefined } => {
  const open = text.lastIndexOf("(");
  if (!text.endsWith(")") || open === -1) return { bare: text, note: undefined };
  return { bare: text.slice(0, open).trim(), note: text.slice(open + 1, -1).trim() };
};

const plainOf = (text: string): string => text.normalize("NFKC").toLowerCase().replace(EMPHASIS, "").trim();

export const normalizeBandText = (text: string): string => splitNote(plainOf(text)).bare;

const normalizeWord = (word: string): string => word.normalize("NFKC").toLowerCase();

/** A unit compared across bands: years and year, kg and kgs are the same unit. */
const unitKey = (unit: string): string => (unit.length > 2 && unit.endsWith("s") ? unit.slice(0, -1) : unit);

type Cursor = { readonly text: string; readonly at: number };

const skipSpace = (cursor: Cursor): Cursor => ({ text: cursor.text, at: cursor.at + (SPACE.exec(cursor.text.slice(cursor.at))?.[0].length ?? 0) });

/** The longest word at the cursor; a Latin word must end at a word edge (to is not the start of total). */
const wordAt = (cursor: Cursor, words: readonly string[]): string | undefined =>
  words
    .map(normalizeWord)
    .filter((word) => word !== "" && cursor.text.startsWith(word, cursor.at))
    .filter((word) => !LATIN_END.test(word) || !LETTER.test(cursor.text.slice(cursor.at + word.length)))
    .reduce<string | undefined>((best, word) => (best === undefined || word.length > best.length ? word : best), undefined);

const advance = (cursor: Cursor, word: string | undefined): Cursor =>
  word === undefined ? cursor : skipSpace({ text: cursor.text, at: cursor.at + word.length });

type Read<T> = { readonly value: T; readonly cursor: Cursor } | undefined;

const numberAt = (cursor: Cursor): Read<{ value: number; decimals: number }> => {
  const written = NUMBER.exec(cursor.text.slice(cursor.at))?.[0];
  if (written === undefined) return undefined;
  const digits = written.replaceAll(",", "");
  return { value: { value: Number(digits), decimals: digits.split(".")[1]?.length ?? 0 }, cursor: advance(cursor, written) };
};

const unitsAt = (cursor: Cursor, words: BandWords, position: "before" | "after"): Read<string | undefined> => {
  const unit = wordAt(
    cursor,
    words.units.filter((entry) => entry.position === position).map((entry) => entry.pattern),
  );
  return { value: unit, cursor: advance(cursor, unit) };
};

const markerAt = (cursor: Cursor, words: BandWords, position: "before" | "after"): Read<BandMarker | undefined> => {
  const markers = words.markers.filter((marker) => marker.position === position);
  const word = wordAt(
    cursor,
    markers.map((marker) => marker.pattern),
  );
  return { value: markers.find((marker) => normalizeWord(marker.pattern) === word), cursor: advance(cursor, word) };
};

/** One number with the units written around it ($5, 7歳, 8 years). */
type Figure = { readonly value: number; readonly decimals: number; readonly units: readonly string[] };

const figureAt = (cursor: Cursor, words: BandWords): Read<Figure> => {
  const prefix = unitsAt(cursor, words, "before");
  const number = prefix === undefined ? undefined : numberAt(prefix.cursor);
  const suffix = number === undefined ? undefined : unitsAt(number.cursor, words, "after");
  if (prefix === undefined || number === undefined || suffix === undefined) return undefined;
  const units = [prefix.value, suffix.value].filter((unit) => unit !== undefined);
  return { value: { ...number.value, units }, cursor: suffix.cursor };
};

const boundOf = (figure: Figure, kind: BoundKind): Bound => ({ value: figure.value, kind, decimals: figure.decimals });

/** A band with the units it was written in. undefined when the text is not one band of one unit. */
type Parsed = { readonly low: Bound | undefined; readonly high: Bound | undefined; readonly units: readonly string[] };

const withMarker = (figure: Figure, marker: BandMarker): Parsed => ({
  low: marker.side === "low" ? boundOf(figure, marker.kind) : undefined,
  high: marker.side === "high" ? boundOf(figure, marker.kind) : undefined,
  units: figure.units,
});

/** One end with its word: 15歳以上, 7 and over, under 7. */
const markedEnd = (cursor: Cursor, words: BandWords): Read<{ readonly parsed: Parsed; readonly side: "low" | "high" }> => {
  const before = markerAt(cursor, words, "before");
  const figure = before === undefined ? undefined : figureAt(before.cursor, words);
  const after = figure === undefined ? undefined : markerAt(figure.cursor, words, "after");
  if (before === undefined || figure === undefined || after === undefined) return undefined;
  const marker = before.value ?? after.value;
  if (marker === undefined || (before.value !== undefined && after.value !== undefined)) return undefined;
  const unit = unitsAt(after.cursor, words, "after");
  if (unit === undefined) return undefined;
  const parsed = withMarker(figure.value, marker);
  return {
    value: { parsed: { ...parsed, units: [...parsed.units, ...(unit.value === undefined ? [] : [unit.value])] }, side: marker.side },
    cursor: unit.cursor,
  };
};

/** 15歳以上, under 7, and both ends with their words: 7歳以上12歳未満. */
const markedBand = (cursor: Cursor, words: BandWords): Read<Parsed> => {
  const first = markedEnd(cursor, words);
  if (first === undefined) return undefined;
  const rest = first.value.side === "low" ? markedEnd(first.cursor, words) : undefined;
  if (rest === undefined || rest.value.side !== "high") return { value: first.value.parsed, cursor: first.cursor };
  const units = [...first.value.parsed.units, ...rest.value.parsed.units];
  return { value: { low: first.value.parsed.low, high: rest.value.parsed.high, units }, cursor: rest.cursor };
};

/** 7〜11歳, 7 to 11, 12歳〜, 〜6歳. */
const spannedBand = (cursor: Cursor, words: BandWords): Read<Parsed> => {
  const leading = wordAt(cursor, words.openers);
  const first = figureAt(advance(cursor, leading), words);
  if (first === undefined) return undefined;
  if (leading !== undefined) return { value: { low: undefined, high: boundOf(first.value, "loose"), units: first.value.units }, cursor: first.cursor };
  const connector = wordAt(first.cursor, words.connectors);
  if (connector === undefined) return undefined;
  const second = figureAt(advance(first.cursor, connector), words);
  if (second === undefined)
    return { value: { low: boundOf(first.value, "loose"), high: undefined, units: first.value.units }, cursor: advance(first.cursor, connector) };
  return {
    value: { low: boundOf(first.value, "loose"), high: boundOf(second.value, "loose"), units: [...first.value.units, ...second.value.units] },
    cursor: second.cursor,
  };
};

/** The band a cell or the head of a list item states, or undefined when the whole text is not one band in one unit. */
export const parseBand = (written: string, words: BandWords): Band | undefined => {
  const text = normalizeBandText(written);
  const start = skipSpace({ text, at: 0 });
  const begun = advance(start, wordAt(start, words.leads));
  const read = [begun, start]
    .flatMap((cursor) => [markedBand(cursor, words), spannedBand(cursor, words)])
    .find((reading) => reading !== undefined && reading.cursor.at === text.length);
  if (read === undefined) return undefined;
  const units = new Set(read.value.units.map(unitKey));
  if (units.size > 1) return undefined;
  const { low, high } = read.value;
  if (low !== undefined && high !== undefined && low.value >= high.value) return undefined;
  return { low, high, unit: [...units][0] ?? "" };
};

/** The kind of a unit, by the unit lexicon. */
export const unitKindOf = (unit: string, words: BandWords): UnitKind | undefined =>
  words.units.find((entry) => unitKey(normalizeWord(entry.pattern)) === unit)?.kind;

/** What bare numbers under a column heading count: by a word of the heading lexicon, or a unit in brackets (体重(kg)). */
export const headingOf = (heading: string, words: BandWords): { readonly unit: string; readonly kind: UnitKind } | undefined => {
  const { bare, note } = splitNote(plainOf(heading).replaceAll("[", "(").replaceAll("]", ")"));
  const unit = note === undefined ? undefined : unitKey(note);
  const unitKind = unit === undefined ? undefined : unitKindOf(unit, words);
  if (unit !== undefined && unitKind !== undefined) return { unit, kind: unitKind };
  const named = words.headings.find((entry) => normalizeWord(entry.pattern) === bare);
  return named === undefined ? undefined : { unit: "", kind: named.kind };
};

type Span = { readonly low: number; readonly high: number };

const POSITIVE = Number.POSITIVE_INFINITY;
const NEGATIVE = Number.NEGATIVE_INFINITY;

/** The band as the values it holds. An integer band's exclusive end is the next whole number in (7歳未満 holds up to 6). */
const spanOf = (band: Band, integer: boolean): Span => {
  const step = integer ? 1 : 0;
  const inward = (bound: Bound): number => (bound.kind === "exclusive" ? step : 0);
  return {
    low: band.low === undefined ? NEGATIVE : band.low.value + inward(band.low),
    high: band.high === undefined ? POSITIVE : band.high.value - inward(band.high),
  };
};

/** Bands written in one direction, each starting and ending past the one before. Nested tiers (〜100万円, 〜200万円) are not. */
const orderOf = (spans: readonly Span[]): "up" | "down" | undefined => {
  const pairs = spans.slice(1).flatMap((span, index): [Span, Span][] => {
    const previous = spans[index];
    return previous === undefined ? [] : [[previous, span]];
  });
  if (pairs.every(([a, b]) => a.low < b.low && a.high < b.high)) return "up";
  if (pairs.every(([a, b]) => a.low > b.low && a.high > b.high)) return "down";
  return undefined;
};

/** Smallest step the two numbers are written to (59 and 60: 1; 59.9 and 60: 0.1). */
const stepOf = (a: Bound, b: Bound): number => 10 ** -Math.max(a.decimals, b.decimals);

const ROUNDING = 1e-9;

type Meeting = "overlap" | "gap" | undefined;

/** Whole numbers: the next band starts one past the end of the one below. */
const integerJunction = (below: Band, above: Band): Meeting => {
  const distance = spanOf(above, true).low - spanOf(below, true).high;
  if (distance <= 0) return "overlap";
  return distance > 1 ? "gap" : undefined;
};

/** At one number, an end included on both sides overlaps and one excluded on both sides leaves the number out. */
const sameNumber = (end: Bound, start: Bound): Meeting => {
  if (start.kind === "inclusive" && end.kind === "inclusive") return "overlap";
  return start.kind === "exclusive" && end.kind === "exclusive" ? "gap" : undefined;
};

/** Values in between: a shared end with a range mark, or ends a written step apart, are contiguous. */
const continuousJunction = (end: Bound, start: Bound): Meeting => {
  if (start.value < end.value) return "overlap";
  if (start.value === end.value) return sameNumber(end, start);
  if (start.kind === "exclusive" || end.kind === "exclusive") return "gap";
  return start.value - end.value > stepOf(start, end) + ROUNDING ? "gap" : undefined;
};

/** Where the band below ends and the band above starts. */
const junctionOf = (below: Band, above: Band, integer: boolean): Meeting => {
  if (below.high === undefined || above.low === undefined) return undefined;
  return integer ? integerJunction(below, above) : continuousJunction(below.high, above.low);
};

const widthOf = (span: Span, integer: boolean): number => span.high - span.low + (integer ? 1 : 0);

type Junction = { readonly kind: "overlap" | "gap"; readonly size: number; readonly narrower: number };

/** How much the bands overlap or leave out, next to the narrower of the two. */
const junctionSize = (kind: "overlap" | "gap", below: Span, above: Span, integer: boolean): Junction => {
  const edge = integer ? 1 : 0;
  const size = kind === "overlap" ? below.high - above.low + edge : above.low - below.high - edge;
  return { kind, size, narrower: Math.min(widthOf(below, integer), widthOf(above, integer)) };
};

/** An overlap of more than half the narrower band is deliberate: a size guide whose bands share a range. */
const isDeliberate = (junction: Junction): boolean => junction.kind === "overlap" && junction.size * 2 > junction.narrower;

/**
 * The overlaps and gaps between neighbouring bands of one column or list. The bands must all be counted in one unit (bare
 * numbers take the column's), written in one direction; the slip is reported at the later of the two in the document. A run
 * with one deliberate overlap is a scale meant to overlap, and two bands alone are reported only when the hole or overlap is
 * no wider than the narrower band.
 */
export const bandSlips = (bands: readonly PlacedBand[], kind: UnitKind): BandSlip[] => {
  if (bands.length < 2) return [];
  const integer = kind === "integer" && bands.every(({ band }) => [band.low, band.high].every((bound) => bound === undefined || bound.decimals === 0));
  const order = orderOf(bands.map(({ band }) => spanOf(band, integer)));
  if (order === undefined) return [];
  const ascending = order === "up" ? [...bands] : [...bands].reverse();
  const junctions = ascending.slice(1).flatMap((above, index) => {
    const below = ascending[index];
    const slip = below === undefined ? undefined : junctionOf(below.band, above.band, integer);
    return below === undefined || slip === undefined
      ? []
      : [{ below, above, ...junctionSize(slip, spanOf(below.band, integer), spanOf(above.band, integer), integer) }];
  });
  if (junctions.some(isDeliberate)) return [];
  const pair = bands.length === 2;
  return junctions
    .filter((junction) => !pair || junction.size <= junction.narrower)
    .map(({ below, above, kind: slip }) => {
      const [earlier, later] = below.start < above.start ? [below, above] : [above, below];
      return { kind: slip, earlier, later };
    });
};

/** The unit and kind of a run of bands: one unit for all (bare numbers take the heading's), or undefined. */
export const runKindOf = (
  bands: readonly Band[],
  heading: { readonly unit: string; readonly kind: UnitKind } | undefined,
  words: BandWords,
): UnitKind | undefined => {
  const units = new Set([...bands.map((band) => band.unit), heading?.unit ?? ""].filter((unit) => unit !== ""));
  if (units.size > 1) return undefined;
  const unit = [...units][0];
  if (unit === undefined) return heading?.kind;
  return unitKindOf(unit, words);
};
