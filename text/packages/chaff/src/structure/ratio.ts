/**
 * ratio-mismatch: the deciding half. A ratio written in percent (営業利益率 7.3%, Operating margin 7.5%) against the numerator
 * and the denominator it names (営業利益 ÷ 売上高), in a results table or in one sentence. Which ratio names which two rows is
 * data (lexicons ratio-label and ratio-term); nothing here knows a word of accounting. Pure.
 */

/** An amount as written: its value in the unit it is written in, the step of its last written digit, and that unit. */
export type Figure = { readonly start: number; readonly value: number; readonly step: number; readonly unit: string };

/** A ratio as written: its value in percent and the number of its decimals. */
export type WrittenRate = { readonly start: number; readonly value: number; readonly decimals: number };

/** A ratio label and the names of the terms it divides (営業利益率 → operating-profit / sales). */
export type RatioLabel = { readonly pattern: string; readonly numerator: string; readonly denominator: string };

export type RatioTerm = { readonly pattern: string; readonly term: string };

export type RatioWords = { readonly labels: readonly RatioLabel[]; readonly terms: readonly RatioTerm[]; readonly percentUnits: readonly string[] };

export type RatioIssue = { readonly offset: number; readonly values: Readonly<Record<string, string>> };

const PERCENT = 100;
const HALF = 0.5;
const DECIMAL_BASE = 10;
/** Floating error must not push a ratio that sits on the edge of its rounding out of it. */
const FLOAT_SLACK = 1e-9;

/** The ratio written as a decimal-point string of the written precision (7.3, 12.50). */
const shown = (value: number, decimals: number): string => value.toFixed(decimals);

/**
 * The ratio the two amounts give, when the written ratio cannot be it; undefined when it can or when they cannot be compared.
 * The written ratio stands for the half step of its last digit around it (7.3% is 7.25% to 7.35%). Each amount may be off by a
 * whole step of its last digit, not half: results tables round down (百万円未満切捨て) as often as to nearest, and the margin is
 * worked out from the unrounded amounts.
 */
export const ratioDisagreement = (rate: WrittenRate, numerator: Figure, denominator: Figure): string | undefined => {
  if (numerator.unit !== denominator.unit || numerator.value < 0 || denominator.value - denominator.step <= 0) return undefined;
  const lowest = (Math.max(0, numerator.value - numerator.step) / (denominator.value + denominator.step)) * PERCENT;
  const highest = ((numerator.value + numerator.step) / (denominator.value - denominator.step)) * PERCENT;
  const half = HALF * DECIMAL_BASE ** -rate.decimals + FLOAT_SLACK;
  if (rate.value + half >= lowest && rate.value - half <= highest) return undefined;
  return shown((numerator.value / denominator.value) * PERCENT, rate.decimals);
};

/** The words compared: NFKC, lower case, one space. */
export const keyOf = (text: string): string => text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();

const PREFIX = /^[^\d\s]*/u;
const NUMBER = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/u;
/** Marks that make an amount negative or a note ((1,200), ▲50, -50, +3%): such a cell is not read. */
const SIGNED = /[-−▲△+＋(（]/u;
const DIGIT = /\d/u;

/** The value of a number written with grouping commas and its decimals apart ("1,320" and "5"). */
const numberOf = (integer: string, decimals: string): number => Number([integer.replaceAll(",", ""), decimals].filter((part) => part !== "").join("."));

type ReadCell = { readonly prefix: string; readonly value: number; readonly decimals: number; readonly suffix: string };

/** A cell holding one number with what is written before and after it ("$2,400 million", "1,320百万円", "7.3%"). */
const readNumber = (text: string): ReadCell | undefined => {
  const plain = text.normalize("NFKC").trim();
  const prefix = PREFIX.exec(plain)?.[0] ?? "";
  const number = NUMBER.exec(plain.slice(prefix.length));
  if (number === null || SIGNED.test(prefix)) return undefined;
  const suffix = plain.slice(prefix.length + number[0].length).trim();
  if (DIGIT.test(suffix) || SIGNED.test(suffix)) return undefined;
  const decimals = number[2] ?? "";
  return { prefix, value: numberOf(number[1] ?? "", decimals), decimals: decimals.length, suffix };
};

/** A cell read as a percentage: a percent unit after the number, or nothing after it when the row says it is in percent. */
export const cellRate = (text: string, start: number, percentUnits: readonly string[], rowInPercent: boolean): WrittenRate | undefined => {
  const cell = readNumber(text);
  if (cell === undefined || cell.prefix !== "") return undefined;
  const inPercent = percentUnits.some((unit) => keyOf(unit) === keyOf(cell.suffix)) || (rowInPercent && cell.suffix === "");
  return inPercent ? { start, value: cell.value, decimals: cell.decimals } : undefined;
};

/** A cell read as an amount, in the unit written around its number. A percentage is not an amount. */
export const cellFigure = (text: string, start: number, percentUnits: readonly string[]): Figure | undefined => {
  const cell = readNumber(text);
  if (cell === undefined || percentUnits.some((unit) => keyOf(unit) === keyOf(cell.suffix))) return undefined;
  return { start, value: cell.value, step: DECIMAL_BASE ** -cell.decimals, unit: `${keyOf(cell.prefix)}|${keyOf(cell.suffix)}` };
};

export type TableCell = { readonly start: number; readonly text: string };

/** A table row: its label (the first cell, as written) and the cells after it. */
export type TableRow = { readonly label: string; readonly cells: readonly TableCell[] };

/** A note in brackets after a row label (営業利益率（%）, Net sales (millions)): not part of the label. */
const LABEL_NOTE = /[(（][^()（）]*[)）]$/u;

const labelKey = (label: string): string => keyOf(label.replace(LABEL_NOTE, ""));

const noteOf = (label: string): string => LABEL_NOTE.exec(label.normalize("NFKC").trim())?.[0] ?? "";

/** The one row whose label is a term of the name; undefined when no row or more than one row is. */
const onlyRow = (rows: readonly TableRow[], terms: readonly RatioTerm[], name: string): TableRow | undefined => {
  const patterns = terms.filter((term) => term.term === name).map((term) => keyOf(term.pattern));
  const found = rows.filter((row) => patterns.includes(labelKey(row.label)));
  return found.length === 1 ? found[0] : undefined;
};

/** An amount cell, in its unit and the unit its row label notes (Net sales (thousand yen)): rows noted differently differ. */
const rowFigure = (cell: TableCell, row: TableRow, percentUnits: readonly string[]): Figure | undefined => {
  const figure = cellFigure(cell.text, cell.start, percentUnits);
  return figure === undefined ? undefined : { ...figure, unit: `${figure.unit}|${keyOf(noteOf(row.label))}` };
};

const sameWidth = (rows: readonly TableRow[]): boolean => rows.every((row) => row.cells.length === rows[0]?.cells.length);

const columnIssues = (ratioRow: TableRow, numeratorRow: TableRow, denominatorRow: TableRow, words: RatioWords): RatioIssue[] => {
  const inPercent = words.percentUnits.some((unit) => noteOf(ratioRow.label).includes(unit.normalize("NFKC")));
  return ratioRow.cells.flatMap((cell, column) => {
    const rate = cellRate(cell.text, cell.start, words.percentUnits, inPercent);
    const top = numeratorRow.cells[column];
    const bottom = denominatorRow.cells[column];
    const numerator = top === undefined ? undefined : rowFigure(top, numeratorRow, words.percentUnits);
    const denominator = bottom === undefined ? undefined : rowFigure(bottom, denominatorRow, words.percentUnits);
    if (rate === undefined || numerator === undefined || denominator === undefined) return [];
    const computed = ratioDisagreement(rate, numerator, denominator);
    return computed === undefined ? [] : [{ offset: rate.start, values: { written: shown(rate.value, rate.decimals), computed } }];
  });
};

/**
 * In one table, each row labelled with a ratio against the one row of its numerator and the one row of its denominator,
 * column by column. A table whose three rows do not have the same number of cells is not read: its columns may not line up.
 */
export const tableRatioMismatches = (rows: readonly TableRow[], words: RatioWords): RatioIssue[] =>
  rows.flatMap((ratioRow) => {
    const label = words.labels.find((entry) => keyOf(entry.pattern) === labelKey(ratioRow.label));
    if (label === undefined) return [];
    const numeratorRow = onlyRow(rows, words.terms, label.numerator);
    const denominatorRow = onlyRow(rows, words.terms, label.denominator);
    if (numeratorRow === undefined || denominatorRow === undefined || !sameWidth([ratioRow, numeratorRow, denominatorRow])) return [];
    return columnIssues(ratioRow, numeratorRow, denominatorRow, words).map((issue) => ({
      offset: issue.offset,
      values: { ...issue.values, ratio: ratioRow.label.trim() },
    }));
  });

/** How amounts are written around their number: currency marks before and after it, and words of magnitude (million, 万). */
export type AmountWords = {
  readonly before: readonly string[];
  readonly after: readonly string[];
  readonly multipliers: readonly string[];
  readonly percentUnits: readonly string[];
};

const PROSE_NUMBER = /(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?![\d,.]\d)/gu;
/** Words after a number ("million", "million yen"). */
const LATIN_WORDS = /^\s+([A-Za-z]+)(?:\s+([A-Za-z]+))?/u;
/** A unit written in kanji or katakana right after a number (百万円, 億円, ドル). A particle in hiragana ends it. */
const CJK_UNIT = /^[\p{sc=Han}\p{sc=Katakana}ー]+/u;
const NEGATIVE_BEFORE = /[-−▲△]$/u;
const LATIN = /^[A-Za-z]/u;
const LETTER = /^\p{L}/u;

const lowered = (words: readonly string[]): string[] => words.map((word) => word.toLowerCase());

/** The unit after a number: a word of magnitude and a currency word, or a run of kanji and katakana. */
const unitAfter = (after: string, words: AmountWords): string => {
  const latin = LATIN_WORDS.exec(after);
  const [first, second] = [latin?.[1]?.toLowerCase() ?? "", latin?.[2]?.toLowerCase() ?? ""];
  const units = lowered([...words.multipliers, ...words.after]);
  if (units.includes(first)) return units.includes(second) ? `${first} ${second}` : first;
  return CJK_UNIT.exec(after)?.[0] ?? "";
};

/** The longest currency mark the text before a number ends with ($, US$, ¥). */
const markBefore = (before: string, marks: readonly string[]): string =>
  marks.filter((mark) => before.endsWith(mark)).toSorted((left, right) => right.length - left.length)[0] ?? "";

/** A percent unit right after the number: a sign as written (7.3%), a word as a whole word (7.3 percent). */
const isPercentAfter = (after: string, units: readonly string[]): boolean => {
  const rest = after.trimStart().toLowerCase();
  return units.some((unit) => {
    const lower = unit.toLowerCase();
    if (!LATIN.test(unit)) return after.startsWith(unit) || (after.startsWith(" ") && rest.startsWith(lower));
    return rest.startsWith(lower) && !LETTER.test(rest.slice(lower.length));
  });
};

/** What a piece of text holds: amounts of money, percentages, and the other numbers (years, counts), by where they start. */
export type ProseValues = { readonly figures: readonly Figure[]; readonly rates: readonly WrittenRate[]; readonly others: readonly number[] };

/**
 * The numbers of a piece of text. An amount of money has a currency mark before it ($, US$) or ends its unit with one (円,
 * yen), and is kept in the unit written around it ("$198 million" is 198 in $|million, 「96百万円」 is 96 in |百万円).
 * Signed numbers (-5, ▲5) are not read at all.
 */
export const proseValues = (text: string, offset: number, words: AmountWords): ProseValues => {
  const figures: Figure[] = [];
  const rates: WrittenRate[] = [];
  const others: number[] = [];
  const currencyAfter = lowered(words.after);
  [...text.matchAll(PROSE_NUMBER)].forEach((match) => {
    const before = text.slice(0, match.index);
    const prefix = markBefore(before, words.before);
    if (NEGATIVE_BEFORE.test(before.slice(0, before.length - prefix.length))) return;
    const decimals = match[2] ?? "";
    const value = numberOf(match[1] ?? "", decimals);
    const after = text.slice(match.index + match[0].length);
    const start = offset + match.index;
    const unit = keyOf(unitAfter(after, words));
    if (isPercentAfter(after, words.percentUnits)) rates.push({ start, value, decimals: decimals.length });
    else if (prefix !== "" || currencyAfter.some((mark) => unit.endsWith(mark))) {
      figures.push({ start, value, step: DECIMAL_BASE ** -decimals.length, unit: `${keyOf(prefix)}|${unit}` });
    } else others.push(start);
  });
  return { figures, rates, others };
};

/** A word of the lexicons found in a sentence. */
export type LabelHit = { readonly start: number; readonly end: number } & ({ readonly label: RatioLabel } | { readonly term: string });

/** What one sentence holds: where it ends, the words found in it, and its numbers. */
export type RatioSentence = ProseValues & { readonly end: number; readonly hits: readonly LabelHit[] };

/** How far after its word a value may start (「営業利益は」, "net sales of", "an operating margin of"). */
const MAX_GAP = 16;

type Value = { readonly start: number } & ({ readonly figure: Figure } | { readonly rate: WrittenRate } | { readonly other: true });

const valuesOf = (sentence: RatioSentence): Value[] => [
  ...sentence.figures.map((figure) => ({ start: figure.start, figure })),
  ...sentence.rates.map((rate) => ({ start: rate.start, rate })),
  ...sentence.others.map((start): Value => ({ start, other: true })),
];

/**
 * The value of a word: the only number between it and the next word of the lexicons (or the end of the sentence), close to
 * it. Two numbers there (「前期の84百万円から96百万円に」, "in 2026 was $198 million") leave it unknown.
 */
const valueAfter = (hit: LabelHit, sentence: RatioSentence): Value | undefined => {
  const until = Math.min(sentence.end, ...sentence.hits.filter((other) => other.start >= hit.end).map((other) => other.start));
  const between = valuesOf(sentence).filter((value) => value.start >= hit.end && value.start < until);
  const only = between.length === 1 ? between[0] : undefined;
  return only !== undefined && only.start - hit.end <= MAX_GAP ? only : undefined;
};

const termHits = (sentence: RatioSentence, name: string): LabelHit[] => sentence.hits.filter((hit) => "term" in hit && hit.term === name);

const figureAfter = (hits: readonly LabelHit[], sentence: RatioSentence): Figure | undefined => {
  const hit = hits.length === 1 ? hits[0] : undefined;
  const value = hit === undefined ? undefined : valueAfter(hit, sentence);
  return value !== undefined && "figure" in value ? value.figure : undefined;
};

/**
 * One sentence that names a ratio, its numerator and its denominator, each once, each with its value right after it
 * (「営業利益は96百万円、売上高は1,320百万円で、営業利益率は7.3%」). Any other shape is not read.
 */
export const sentenceRatioMismatch = (sentence: RatioSentence): RatioIssue | undefined => {
  const ratios = sentence.hits.filter((hit) => "label" in hit);
  const ratio = ratios.length === 1 ? ratios[0] : undefined;
  if (ratio === undefined || !("label" in ratio)) return undefined;
  const value = valueAfter(ratio, sentence);
  const numerator = figureAfter(termHits(sentence, ratio.label.numerator), sentence);
  const denominator = figureAfter(termHits(sentence, ratio.label.denominator), sentence);
  if (value === undefined || !("rate" in value) || numerator === undefined || denominator === undefined) return undefined;
  const computed = ratioDisagreement(value.rate, numerator, denominator);
  return computed === undefined
    ? undefined
    : { offset: value.start, values: { written: shown(value.rate.value, value.rate.decimals), computed, ratio: ratio.label.pattern } };
};
