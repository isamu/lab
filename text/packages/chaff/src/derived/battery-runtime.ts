// capacity-runtime-mismatch: a battery capacity divided by the stated consumption is the longest the device can run; a stated
// runtime above it by more than its written precision cannot be right (5000 mAh at 500 mA is 10 h, not 15 h). The item names
// come from battery-label, the units from battery-unit and unit-time, the rough marks from approximate-marker. Pure.

export type Family = "charge" | "current" | "energy" | "power";
export type Role = "capacity" | "consumption" | "runtime";

export type ScaledUnit = { readonly pattern: string; readonly weight: number };
export type ElectricUnit = ScaledUnit & { readonly family: Family };
export type Marker = { readonly pattern: string; readonly position: "before" | "after" };

export type BatteryWords = {
  readonly electric: readonly ElectricUnit[];
  /** Units of time, weight in seconds. */
  readonly time: readonly ScaledUnit[];
  readonly approximate: readonly Marker[];
  /** Marks that bound a value from one side (以上, 以内, at least, under): the value is not compared at all. */
  readonly bounds: readonly Marker[];
  readonly connectors: readonly string[];
  readonly labels: readonly { readonly pattern: string; readonly group: string }[];
};

/** A value as written: the low and high end of a range (the same for one number), in mAh, mA, Wh, W or seconds. */
export type Reading = {
  readonly low: number;
  readonly high: number;
  readonly family: Family | "time";
  /** One step of the last written digit, in the reading's unit (15時間 → 3600 s, 10.5 h → 360 s). */
  readonly step: number;
  readonly approximate: boolean;
};

export type LabelReading = { readonly role: Role; readonly standby: boolean; readonly peak: boolean; readonly condition: string };

export type Entry = LabelReading & { readonly reading: Reading; readonly start: number; readonly text: string };

export type CapacityRuntimeMismatch = {
  readonly capacity: Entry;
  readonly consumption: Entry;
  readonly runtime: Entry;
  readonly idealHours: number;
};

const SECONDS_PER_HOUR = 3600;
const APPROXIMATE_FACTOR = 2;
const EPSILON = 1e-9;
const NUMBER = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/u;
const LETTER = /\p{L}/u;
const SPACES = /^\s*/u;

const normal = (text: string): string => text.normalize("NFKC").trim();
const folded = (text: string): string => normal(text).toLowerCase();
const conditionKey = (text: string): string => folded(text).replace(/\s+/gu, "");

/** The text without a note in brackets at its end, and the note (連続再生時間（音量50%）). */
export const splitCondition = (text: string): { readonly bare: string; readonly condition: string } => {
  const plain = normal(text);
  const open = plain.lastIndexOf("(");
  if (!plain.endsWith(")") || open <= 0) return { bare: plain, condition: "" };
  return { bare: plain.slice(0, open).trim(), condition: conditionKey(plain.slice(open + 1, -1)) };
};

const wordsOf = (words: BatteryWords, group: string): string[] => words.labels.filter((entry) => entry.group === group).map((entry) => folded(entry.pattern));

const holds = (text: string, patterns: readonly string[]): boolean => patterns.some((pattern) => text.includes(pattern));

const EDGE_MARKS = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/** Whether a condition or a heading is only one of the words, with a word of the state after it (待機時, Max., idle mode). */
const isOnly = (text: string, patterns: readonly string[], words: BatteryWords): boolean => {
  const bare = folded(text).replace(EDGE_MARKS, "");
  const suffixes = ["", ...wordsOf(words, "state")];
  return patterns.some((pattern) => suffixes.some((suffix) => [pattern + suffix, `${pattern} ${suffix}`].includes(bare)));
};

const ROLES: readonly Role[] = ["capacity", "consumption", "runtime"];

/** What an item name says: which value, under which condition, whether idle or at the maximum. */
export const labelOf = (label: string, words: BatteryWords): LabelReading | undefined => {
  const { bare, condition } = splitCondition(label);
  const head = folded(bare);
  const roles = ROLES.filter((role) => holds(head, wordsOf(words, role)));
  const [role] = roles;
  if (role === undefined || roles.length > 1) return undefined;
  const standby = wordsOf(words, "standby");
  return {
    role,
    standby: holds(head, standby) || (role === "consumption" && isOnly(condition, standby, words)),
    peak: holds(head, wordsOf(words, "peak")) || isOnly(condition, wordsOf(words, "peak"), words),
    condition,
  };
};

/** Whether a column heading is only a word of the maximum (最大, Max.). */
export const isPeakHeading = (heading: string, words: BatteryWords): boolean => isOnly(heading, wordsOf(words, "peak"), words);

type Stripped = { readonly core: string; readonly marks: readonly string[] };

const markAt = (text: string, marker: Marker): boolean => {
  const lower = text.toLowerCase();
  const pattern = folded(marker.pattern);
  return marker.position === "before" ? lower.startsWith(pattern) : lower.endsWith(pattern);
};

const stripOnce = (text: string, markers: readonly Marker[]): Stripped | undefined => {
  const marker = markers.find((candidate) => markAt(text, candidate));
  if (marker === undefined) return undefined;
  const length = folded(marker.pattern).length;
  const core = marker.position === "before" ? text.slice(length) : text.slice(0, text.length - length);
  return { core: core.trim(), marks: [folded(marker.pattern)] };
};

const MAX_MARKS = 3;

/** The value without the marks around it (約, 最大, 以上, about, up to), and the marks taken off. */
export const stripMarks = (text: string, markers: readonly Marker[]): Stripped =>
  Array.from({ length: MAX_MARKS }).reduce<Stripped>(
    (stripped) => {
      const next = stripOnce(stripped.core, markers);
      return next === undefined ? stripped : { core: next.core, marks: [...stripped.marks, ...next.marks] };
    },
    { core: normal(text), marks: [] },
  );

type Scanned = { readonly value: number; readonly decimals: number; readonly unit: ScaledUnit | undefined; readonly end: number };

const byLength = (units: readonly ScaledUnit[]): ScaledUnit[] => [...units].sort((left, right) => right.pattern.length - left.pattern.length);

/** The unit written at `at`, not running on into a word. A unit in lower case (hours) is read in any case; mA and W as written. */
const unitAt = (text: string, at: number, units: readonly ScaledUnit[]): ScaledUnit | undefined =>
  byLength(units).find((unit) => {
    const pattern = normal(unit.pattern);
    const written = text.slice(at, at + pattern.length);
    const caseless = pattern === pattern.toLowerCase();
    return (caseless ? written.toLowerCase() === pattern : written === pattern) && !LETTER.test(text[at + pattern.length] ?? "");
  });

const spacesAt = (text: string, at: number): number => at + (SPACES.exec(text.slice(at))?.[0].length ?? 0);

/** A number at `at` and the unit right after it (spaces between allowed). */
const scanAt = (text: string, at: number, units: readonly ScaledUnit[]): Scanned | undefined => {
  const number = NUMBER.exec(text.slice(at))?.[0];
  if (number === undefined) return undefined;
  const unitStart = spacesAt(text, at + number.length);
  const unit = unitAt(text, unitStart, units);
  const end = unit === undefined ? at + number.length : unitStart + normal(unit.pattern).length;
  return { value: Number(number.replaceAll(",", "")), decimals: number.split(".")[1]?.length ?? 0, unit, end };
};

/** Every number and unit from `at` to the end; a number without a unit only last. Undefined when anything else is written. */
const scanAll = (text: string, at: number, units: readonly ScaledUnit[]): Scanned[] | undefined => {
  const from = spacesAt(text, at);
  if (from >= text.length) return [];
  const scanned = scanAt(text, from, units);
  if (scanned === undefined) return undefined;
  if (scanned.unit === undefined) return spacesAt(text, scanned.end) >= text.length ? [scanned] : undefined;
  const rest = scanAll(text, scanned.end, units);
  return rest === undefined ? undefined : [scanned, ...rest];
};

const DECIMAL_BASE = 10;

type Side = { readonly value: number; readonly step: number; readonly unit: ScaledUnit | undefined };

/** One side of a range: a number and unit, or for time a run of them (10時間30分, 1 h 30 min), or a bare number. */
const sideOf = (text: string, units: readonly ScaledUnit[], compound: boolean): Side | undefined => {
  const parts = scanAll(text, 0, units);
  const last = parts?.at(-1);
  if (parts === undefined || last === undefined || (parts.length > 1 && (!compound || last.unit === undefined))) return undefined;
  const step = DECIMAL_BASE ** -last.decimals;
  if (last.unit === undefined) return { value: last.value, step, unit: undefined };
  const value = parts.reduce((sum, part) => sum + part.value * (part.unit?.weight ?? 0), 0);
  return { value, step: step * last.unit.weight, unit: last.unit };
};

const splitRange = (text: string, connectors: readonly string[]): readonly string[] => {
  const connector = connectors.map(normal).find((candidate) => text.indexOf(candidate) > 0);
  if (connector === undefined) return [text];
  const at = text.indexOf(connector);
  return [text.slice(0, at).trim(), text.slice(at + connector.length).trim()];
};

/** A side written without a unit (8〜10時間) takes the unit of the other side. */
const withUnit = (side: Side, other: Side): Side | undefined =>
  side.unit !== undefined
    ? side
    : other.unit === undefined
      ? undefined
      : { value: side.value * other.unit.weight, step: side.step * other.unit.weight, unit: other.unit };

const rangeOf = (core: string, units: readonly ScaledUnit[], connectors: readonly string[], compound: boolean): [Side, Side] | undefined => {
  const parts = splitRange(core, connectors);
  const sides = parts.map((part) => sideOf(part, units, compound));
  const [first, second] = sides;
  if (sides.some((side) => side === undefined) || first === undefined) return undefined;
  if (second === undefined) return first.unit === undefined ? undefined : [first, first];
  const low = withUnit(first, second);
  return low === undefined || second.unit === undefined ? undefined : [low, second];
};

const familyOf = (unit: ScaledUnit | undefined, units: readonly ElectricUnit[]): Family | undefined => units.find((candidate) => candidate === unit)?.family;

const ROLE_FAMILIES: Readonly<Record<Role, readonly (Family | "time")[]>> = {
  capacity: ["charge", "energy"],
  consumption: ["current", "power"],
  runtime: ["time"],
};

export type ValueReading = { readonly reading: Reading; readonly peak: boolean };

/**
 * A value cell or the value after a label's colon. A runtime is a time (15時間, 8〜10 hours, 1 h 30 min); a capacity or a
 * consumption one number with an electric unit, or a range of them. A note in brackets at the end is not part of it.
 * Undefined when the value is anything else, or is bounded from one side (10時間以上, under 500 mA).
 */
export const valueOf = (text: string, role: Role, words: BatteryWords): ValueReading | undefined => {
  const { bare } = splitCondition(text);
  const { core, marks } = stripMarks(bare, words.approximate);
  if (words.bounds.some((marker) => markAt(bare, marker) || markAt(core, marker))) return undefined;
  const units: readonly ScaledUnit[] = role === "runtime" ? words.time : words.electric;
  const range = rangeOf(core, units, words.connectors, role === "runtime");
  if (range === undefined) return undefined;
  const [low, high] = range;
  const family = role === "runtime" ? "time" : familyOf(high.unit, words.electric);
  if (family === undefined || !ROLE_FAMILIES[role].includes(family) || (role !== "runtime" && familyOf(low.unit, words.electric) !== family)) return undefined;
  const reading: Reading = { low: low.value, high: high.value, family, step: low.step, approximate: marks.length > 0 };
  return { reading, peak: marks.some((mark) => wordsOf(words, "peak").includes(mark)) };
};

const DIVIDES: Readonly<Record<string, Family>> = { current: "charge", power: "energy" };

/** The consumption a runtime is read against: the one under the same condition, or the only one. */
const partnerOf = (runtime: Entry, consumptions: readonly Entry[]): Entry | undefined => {
  const kind = consumptions.filter((entry) => entry.standby === runtime.standby);
  const same = kind.filter((entry) => entry.condition === runtime.condition);
  if (same.length === 1) return same[0];
  const [only] = kind;
  return same.length === 0 && kind.length === 1 && only !== undefined && (only.condition === "" || runtime.condition === "") ? only : undefined;
};

/** The one capacity a consumption divides: of the matching kind, and only one value of it. */
const capacityFor = (consumption: Entry, capacities: readonly Entry[]): Entry | undefined => {
  const kind = capacities.filter((entry) => entry.reading.family === DIVIDES[consumption.reading.family]);
  const values = new Set(kind.map((entry) => entry.reading.high));
  return values.size === 1 ? kind[0] : undefined;
};

type Pair = readonly [runtime: Entry, consumption: Entry];

const pairsOf = (entries: readonly Entry[]): Pair[] => {
  const consumptions = entries.filter((entry) => entry.role === "consumption" && !entry.peak);
  const pairs = entries
    .filter((entry) => entry.role === "runtime")
    .flatMap((runtime): Pair[] => {
      const partner = partnerOf(runtime, consumptions);
      return partner === undefined ? [] : [[runtime, partner]];
    });
  return pairs.filter(([, consumption]) => pairs.filter(([, other]) => other === consumption).length === 1);
};

/**
 * Runtimes stated above what the capacity divided by the consumption allows. Entries are one device's: one key-value table and
 * the labelled lines of a section, or one column of a wider table. The margin is one step of the runtime's last written digit
 * (15時間 → 1 h), twice that when any of the three is marked rough (約, about). A runtime at or below the ideal is normal.
 */
export const capacityRuntimeMismatches = (entries: readonly Entry[]): CapacityRuntimeMismatch[] => {
  const capacities = entries.filter((entry) => entry.role === "capacity");
  return pairsOf(entries).flatMap(([runtime, consumption]) => {
    const capacity = capacityFor(consumption, capacities);
    if (capacity === undefined || consumption.reading.low <= 0) return [];
    const idealHours = capacity.reading.high / consumption.reading.low;
    const rough = [runtime, consumption, capacity].some((entry) => entry.reading.approximate);
    const margin = (runtime.reading.step / SECONDS_PER_HOUR) * (rough ? APPROXIMATE_FACTOR : 1);
    const statedHours = runtime.reading.low / SECONDS_PER_HOUR;
    return statedHours > idealHours + margin + EPSILON ? [{ capacity, consumption, runtime, idealHours }] : [];
  });
};
