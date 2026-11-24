// The numbers written at the head of list items and numbered paragraphs (1. / (1) / ① / 一、 / i) / a.), and the runs they
// form: items at one indentation, one after another, with nothing but their own text between. Pure; reads lines only.

/** What a number is written with. Case counts: (a) and (A) are two forms. */
type NumeralKind = "arabic" | "kanji" | "circled" | "paren-sign" | "lower-letter" | "upper-letter" | "lower-roman" | "upper-roman";

/** What follows or encloses the number: 1. / 1) / (1) / 一、. A circled or parenthesised sign (①, ⑴) has none. */
type Delimiter = "dot" | "close" | "paren" | "comma" | "sign";

/** One numbered item: where its number starts, the number as written, its form and its place in the counting. */
export type EnumerationItem = {
  readonly start: number;
  readonly lineEnd: number;
  readonly mark: string;
  readonly form: string;
  readonly value: number;
};

type Reading = { readonly kind: NumeralKind; readonly value: number };

const FULLWIDTH_OFFSET = 0xfee0;
const halfWidth = (text: string): string => text.replace(/[０-９Ａ-Ｚａ-ｚ]/gu, (char) => String.fromCharCode(char.charCodeAt(0) - FULLWIDTH_OFFSET));

const KANJI_DIGITS: Readonly<Record<string, number>> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const KANJI_TEN = "十";
const TEN = 10;

/** 一 … 九十九. */
const kanjiValue = (text: string): number | undefined => {
  const [tens = "", ones = ""] = text.includes(KANJI_TEN) ? text.split(KANJI_TEN) : ["", text];
  const writtenTens = tens === "" ? 1 : KANJI_DIGITS[tens];
  const tensValue = text.includes(KANJI_TEN) ? writtenTens : 0;
  const onesValue = ones === "" ? 0 : KANJI_DIGITS[ones];
  return tensValue === undefined || onesValue === undefined || tens.length > 1 || ones.length > 1 ? undefined : tensValue * TEN + onesValue;
};

const ROMAN_VALUES: Readonly<Record<string, number>> = { i: 1, v: 5, x: 10 };
const ROMAN = /^x{0,3}(?:ix|iv|v?i{0,3})$/u;

/** i … xxxix; undefined if the letters are not a Roman number. */
const romanValue = (text: string): number | undefined => {
  const lower = text.toLowerCase();
  if (lower === "" || !ROMAN.test(lower)) return undefined;
  const values = [...lower].map((char) => ROMAN_VALUES[char] ?? 0);
  return values.reduce((sum, value, at) => (value < (values[at + 1] ?? 0) ? sum - value : sum + value), 0);
};

const LETTER_BASE = "a".charCodeAt(0) - 1;
const letterValue = (char: string): number => char.toLowerCase().charCodeAt(0) - LETTER_BASE;
const isUpper = (text: string): boolean => text === text.toUpperCase();

/** A single i, v or x is a letter or a Roman number; the item before it decides. */
const AMBIGUOUS = /^[ivxIVX]$/u;

const CIRCLED_FIRST = 0x2460;
const CIRCLED_LAST = 0x2473;
const CIRCLED_LATER_FIRST = 0x3251;
const CIRCLED_LATER_LAST = 0x325f;
const CIRCLED_LATER_VALUE = 21;
const PAREN_SIGN_FIRST = 0x2474;
const PAREN_SIGN_LAST = 0x2487;

const signReading = (char: string): Reading | undefined => {
  const code = char.codePointAt(0) ?? 0;
  if (code >= CIRCLED_FIRST && code <= CIRCLED_LAST) return { kind: "circled", value: code - CIRCLED_FIRST + 1 };
  if (code >= CIRCLED_LATER_FIRST && code <= CIRCLED_LATER_LAST) return { kind: "circled", value: code - CIRCLED_LATER_FIRST + CIRCLED_LATER_VALUE };
  if (code >= PAREN_SIGN_FIRST && code <= PAREN_SIGN_LAST) return { kind: "paren-sign", value: code - PAREN_SIGN_FIRST + 1 };
  return undefined;
};

/** The readings of a number written with letters or digits, the likelier first. */
const readingsOf = (numeral: string): Reading[] => {
  const sign = signReading(numeral);
  if (sign !== undefined) return [sign];
  const text = halfWidth(numeral);
  if (/^\d+$/u.test(text)) return [{ kind: "arabic", value: Number(text) }];
  const kanji = kanjiValue(text);
  if (kanji !== undefined) return [{ kind: "kanji", value: kanji }];
  const roman = romanValue(text);
  const romanReading: Reading[] = roman === undefined ? [] : [{ kind: isUpper(text) ? "upper-roman" : "lower-roman", value: roman }];
  const letterReading: Reading[] = /^[a-zA-Z]$/u.test(text) ? [{ kind: isUpper(text) ? "upper-letter" : "lower-letter", value: letterValue(text) }] : [];
  return AMBIGUOUS.test(text) && text.toLowerCase() !== "i" ? [...letterReading, ...romanReading] : [...romanReading, ...letterReading];
};

const NUMERAL = "[0-9０-９]{1,3}|[一二三四五六七八九十]{1,3}|[a-zA-Zａ-ｚＡ-Ｚ]|[ivxIVX]{2,6}";
const SIGN = "[\\u2460-\\u2487\\u3251-\\u325f]";

/** What may follow the number: a space, or a word or an opening quotation written straight after it. */
const TEXT_FOLLOWS = '(?=[\\s\\u3000]*[\\p{L}「『“"`(（])';

/** The forms an item's number is written in, tried in order. Letters with a dot must be followed by a space (e.g. is not an item). */
const SHAPES: ReadonlyArray<{ readonly delimiter: Delimiter; readonly pattern: RegExp }> = [
  { delimiter: "paren", pattern: new RegExp(`^[(（](${NUMERAL})[)）]${TEXT_FOLLOWS}`, "u") },
  { delimiter: "close", pattern: new RegExp(`^(${NUMERAL})[)）]${TEXT_FOLLOWS}`, "u") },
  { delimiter: "dot", pattern: new RegExp(`^([0-9０-９]{1,3}|[一二三四五六七八九十]{1,3})[.．](?![0-9０-９])${TEXT_FOLLOWS}`, "u") },
  { delimiter: "dot", pattern: /^([a-zA-Z]|[ivxIVX]{2,6})\.(?=[ \t\u3000]+\p{L})/u },
  { delimiter: "comma", pattern: /^([0-9０-９]{1,3}|[一二三四五六七八九十]{1,3})、(?=\p{L}|[「『])/u },
  { delimiter: "sign", pattern: new RegExp(`^(${SIGN})${TEXT_FOLLOWS}`, "u") },
];

/** A number at the head of a line with no other number before it: the mark as written, the number inside, and how it is delimited. */
type Head = { readonly mark: string; readonly numeral: string; readonly delimiter: Delimiter };

const headOf = (text: string): Head | undefined => {
  const shape = SHAPES.map((candidate) => ({ candidate, match: candidate.pattern.exec(text) })).find(({ match }) => match !== null);
  const numeral = shape?.match?.[1];
  const mark = shape?.match?.[0];
  return shape === undefined || numeral === undefined || mark === undefined ? undefined : { mark, numeral, delimiter: shape.candidate.delimiter };
};

/** Lines that close every run: a heading, a rule, a table row, a quotation. */
const BREAK = /^(?:#{1,6}(?:\s|$)|[-*_](?:\s*[-*_]){2,}\s*$|\||>)/u;

const INDENT = /^[ \t\u3000]*/u;
const TAB_WIDTH = 4;
const widthOf = (indent: string): number => [...indent].reduce((width, char) => width + (char === "\t" ? TAB_WIDTH : 1), 0);

type Line = { readonly start: number; readonly text: string };

const linesOf = (text: string): Line[] => {
  const lines: Line[] = [];
  text.split("\n").forEach((line) => {
    const previous = lines.at(-1);
    lines.push({ start: previous === undefined ? 0 : previous.start + previous.text.length + 1, text: line });
  });
  return lines;
};

/** An item before the form is settled: a single i, v or x waits for the item before it. */
type Candidate = Omit<EnumerationItem, "form" | "value"> & { readonly delimiter: Delimiter; readonly readings: readonly Reading[] };

const formOf = (reading: Reading, delimiter: Delimiter): string =>
  reading.kind === "circled" || reading.kind === "paren-sign" ? reading.kind : `${reading.kind}:${delimiter}`;

/** Settles each item's reading: the one that goes on from the item before it, else the one of the same kind, else the likelier. */
const settled = (candidates: readonly Candidate[]): EnumerationItem[] =>
  candidates.reduce<EnumerationItem[]>((items, candidate) => {
    const previous = items.at(-1);
    const sameKind = (reading: Reading): boolean => previous !== undefined && formOf(reading, candidate.delimiter) === previous.form;
    const reading =
      candidate.readings.find((option) => sameKind(option) && option.value === (previous?.value ?? 0) + 1) ??
      candidate.readings.find(sameKind) ??
      candidate.readings[0];
    if (reading === undefined) return items;
    const { start, lineEnd, mark } = candidate;
    return [...items, { start, lineEnd, mark, form: formOf(reading, candidate.delimiter), value: reading.value }];
  }, []);

type OpenRun = { readonly indent: number; readonly items: Candidate[] };

/**
 * The runs of numbered items in a text: items at one indentation, one after another. A line of text right under an item, or
 * indented deeper than it, belongs to the item. A run ends at a heading, a rule, a table or a quotation, at a line less indented
 * than its items, and at a new paragraph that starts at its indentation without a number.
 */
export const enumerationRuns = (text: string): EnumerationItem[][] => {
  const closed: Candidate[][] = [];
  const open: OpenRun[] = [];
  const closeWhere = (keep: (run: OpenRun) => boolean): void => {
    const kept = open.filter(keep);
    closed.push(...open.filter((run) => !keep(run)).map((run) => run.items));
    open.splice(0, open.length, ...kept);
  };
  const state = { afterBlank: false };
  linesOf(text).forEach((line) => {
    const afterBlank = state.afterBlank;
    const indentText = INDENT.exec(line.text)?.[0] ?? "";
    const body = line.text.slice(indentText.length);
    state.afterBlank = body.trim() === "";
    if (state.afterBlank) return;
    if (BREAK.test(body)) {
      closeWhere(() => false);
      return;
    }
    const indent = widthOf(indentText);
    const head = headOf(body);
    if (head === undefined) {
      closeWhere((run) => run.indent < indent || (run.indent === indent && !afterBlank));
      return;
    }
    closeWhere((run) => run.indent <= indent);
    const run = open.find((candidate) => candidate.indent === indent) ?? { indent, items: [] };
    if (!open.includes(run)) open.push(run);
    const start = line.start + indentText.length;
    run.items.push({ start, lineEnd: line.start + line.text.length, mark: head.mark.trim(), delimiter: head.delimiter, readings: readingsOf(head.numeral) });
  });
  closeWhere(() => false);
  return closed.map(settled).filter((items) => items.length > 0);
};

/** An item written in another form than most items of its run, and the form it differs from. */
export type EnumerationMinority = { readonly item: EnumerationItem; readonly usual: EnumerationItem; readonly count: number };

/** Fewer items than this, and no form is the run's habit yet. */
const MIN_ITEMS = 3;

/** The form most items of a run use; undefined on a tie. */
const majorityOf = (items: readonly EnumerationItem[]): { readonly form: string; readonly count: number } | undefined => {
  const counts = [...items.reduce((acc, item) => acc.set(item.form, (acc.get(item.form) ?? 0) + 1), new Map<string, number>())].toSorted(
    ([, left], [, right]) => right - left,
  );
  const [first, second] = counts;
  return first === undefined || second?.[1] === first[1] ? undefined : { form: first[0], count: first[1] };
};

/** The run's usual form counts up without starting again; one that restarts (a) (b) … (a) (b) is the level below. */
const neverRestarts = (items: readonly EnumerationItem[], usual: string): boolean =>
  items.filter((item) => item.form === usual).every((item, index, same) => index === 0 || item.value > (same[index - 1]?.value ?? 0));

/**
 * Whether the item at `at` counts on with the usual form's numbers: every item from the usual-form item before it to the one
 * after it goes up by one (1. 2. 3) 4.). A sub-list written in its own form starts again at 1 (1. (1) (2) 2.), and is left.
 * So is an item whose own form counted the number before it earlier in the run ((1) (a) (b) (2) (a) (b) (3)): that form is a
 * level of its own.
 */
const countsOn = (items: readonly EnumerationItem[], at: number, usual: string): boolean => {
  const before = items.findLastIndex((item, index) => index < at && item.form === usual);
  const afterIndex = items.findIndex((item, index) => index > at && item.form === usual);
  const from = before === -1 ? 0 : before;
  const to = afterIndex === -1 ? items.length - 1 : afterIndex;
  const stretch = items.slice(from, to + 1);
  const own = items[at];
  const ownCounter = items.slice(0, from).some((item) => item.form === own?.form && item.value === own.value - 1);
  return !ownCounter && stretch.length > 1 && stretch.every((item, index) => index === 0 || item.value === (stretch[index - 1]?.value ?? 0) + 1);
};

/** The items of a run written in a minority form while counting on with the others. */
export const enumerationMinorities = (items: readonly EnumerationItem[]): EnumerationMinority[] => {
  const majority = items.length < MIN_ITEMS ? undefined : majorityOf(items);
  const usual = items.find((item) => item.form === majority?.form);
  if (majority === undefined || usual === undefined || !neverRestarts(items, majority.form)) return [];
  return items.flatMap((item, at) => (item.form !== majority.form && countsOn(items, at, majority.form) ? [{ item, usual, count: majority.count }] : []));
};
