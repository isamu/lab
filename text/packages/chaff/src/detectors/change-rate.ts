// change-rate-mismatch: the reading half. Builds the figures, the rates and the words of structure/change-rate.ts from the
// tree's quantities, the numbers counted with a word ("1,200 companies"), the calendar years, and the lexicons change-direction,
// change-base, change-target, change-break, percent-unit and amount-multiplier.
import type { Detector, Finding, LexiconEntry, ProseDocument, Span, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { changeRateMismatches, type BaseMark, type Break, type Direction, type Figure, type Period, type Rate } from "../structure/change-rate.ts";
import { escapeRegExp } from "../orthography.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const DIGITS = /\d[\d,]*(?:\.(\d+))?/u;
const DECIMAL_BASE = 10;
const LATIN = /^[A-Za-z]/u;

/** The step a number is written to: its last digit, times the magnitude the tree folded into the value (12億 is 12 × 1億). */
const stepOf = (written: string, value: number): number | undefined => {
  const found = DIGITS.exec(written.normalize("NFKC"));
  const shown = found === null ? Number.NaN : Number(found[0].replaceAll(",", ""));
  if (!Number.isFinite(shown) || shown === 0) return undefined;
  return (value / shown) * DECIMAL_BASE ** -(found?.[1]?.length ?? 0);
};

/** A word of magnitude right after the number ("$12 million"): the values compared must be written to the same one. */
const WORD_AFTER = /^\s+([A-Za-z]+)/u;
const WORDS_AFTER = /^\s+([A-Za-z]+)(?:\s+([A-Za-z]+))?/u;

const multiplierAfter = (source: string, end: number, multipliers: readonly string[]): string => {
  const after = WORD_AFTER.exec(source.slice(end))?.[1]?.toLowerCase() ?? "";
  return multipliers.includes(after) ? after : "";
};

const quantityNodes = (tree: StructureNode): StructureNode[] => inDocumentOrder(tree).filter((node) => node.kind === "quantity" || node.kind === "date");

const ratesOf = (doc: ProseDocument, nodes: readonly StructureNode[], units: readonly string[]): Rate[] =>
  nodes.flatMap((node) => {
    const unit = String(node.attrs["unit"] ?? "");
    if (node.kind !== "quantity" || !units.includes(unit)) return [];
    const decimals = DIGITS.exec(doc.source.slice(node.span.start, node.span.end).normalize("NFKC"))?.[1]?.length ?? 0;
    return [{ start: node.span.start, end: node.span.end, value: Number(node.attrs["value"]), decimals }];
  });

const treeFigures = (doc: ProseDocument, nodes: readonly StructureNode[], units: readonly string[], multipliers: readonly string[]): Figure[] =>
  nodes.flatMap((node) => {
    const unit = String(node.attrs["unit"] ?? "");
    const value = Number(node.attrs["value"]);
    const step = stepOf(doc.source.slice(node.span.start, node.span.end), value);
    if (node.kind !== "quantity" || units.includes(unit) || step === undefined) return [];
    return [{ start: node.span.start, end: node.span.end, value, step, unit: `${unit}|${multiplierAfter(doc.source, node.span.end, multipliers)}` }];
  });

/** A number with no unit the tree reads, counted with the word after it ("1,200 companies", "2.4 million users"). */
const COUNTED = /(?<![\w.,$€£¥])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?=\s+[A-Za-z])/gu;
/** A year written alone ("2024 revenue"): a point in time, not a value. */
const YEAR = /^(?:1[89]|2[01])\d{2}$/u;

/** The unit a counted number is compared in: the word after it, with a word of magnitude before that word ("million users"). */
const countedUnit = (source: string, end: number, multipliers: readonly string[]): string | undefined => {
  const words = WORDS_AFTER.exec(source.slice(end));
  const first = words?.[1]?.toLowerCase() ?? "";
  const multiplier = multipliers.includes(first) ? first : "";
  const noun = multiplier === "" ? first : (words?.[2]?.toLowerCase() ?? "");
  return LATIN.test(noun) ? `${noun}|${multiplier}` : undefined;
};

const countedFigures = (doc: ProseDocument, taken: readonly Span[], multipliers: readonly string[]): Figure[] =>
  [...doc.source.matchAll(COUNTED)].flatMap((match) => {
    const start = match.index;
    const end = start + match[0].length;
    const unit = countedUnit(doc.source, end, multipliers);
    if (unit === undefined || taken.some((span) => span.start < end && start < span.end) || YEAR.test(match[0])) return [];
    const decimals = match[2] ?? "";
    const value = Number([(match[1] ?? "").replaceAll(",", ""), decimals].filter((part) => part !== "").join("."));
    return [{ start, end, value, step: DECIMAL_BASE ** -decimals.length, unit }];
  });

/** Where a word of the lexicon stands in the source: a Latin word as a whole word, anything else as written. */
const spansOf = (source: string, word: string): Span[] => {
  const pattern = LATIN.test(word) ? new RegExp(`\\b${escapeRegExp(word)}\\b`, "giu") : new RegExp(escapeRegExp(word), "gu");
  return [...source.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
};

const SIGNS: Readonly<Record<string, 1 | -1>> = { rise: 1, fall: -1 };

/** Where the words of a lexicon stand, less those inside a phrase of its "-not" lexicon ("up to 25%" is a ceiling). */
const spansWithout = (doc: ProseDocument, entries: readonly LexiconEntry[], notLexicon: string): (Span & { readonly entry: LexiconEntry })[] => {
  const not = patternsOf(doc, notLexicon).flatMap((phrase) => spansOf(doc.source, phrase));
  return entries.flatMap((entry) =>
    spansOf(doc.source, entry.pattern)
      .filter((span) => !not.some((phrase) => phrase.start <= span.start && span.end <= phrase.end))
      .map((span) => ({ ...span, entry })),
  );
};

/** Lexicon change-direction, less the phrases of change-direction-not. */
const directionsOf = (doc: ProseDocument): Direction[] =>
  spansWithout(doc, doc.lexicons["change-direction"] ?? [], "change-direction-not").flatMap(({ start, end, entry }) => {
    const sign = SIGNS[entry.group ?? ""];
    return sign === undefined ? [] : [{ start, end, sign }];
  });

/** Lexicon change-break (「は」, "and"), less the phrases of change-break-not (「上がり」 holds が but starts no subject). */
const breaksOf = (doc: ProseDocument): Break[] =>
  spansWithout(doc, doc.lexicons["change-break"] ?? [], "change-break-not").map(({ start, end, entry }) => ({
    start,
    end,
    beforeRateOnly: entry.group === "rate",
  }));

/** A calendar year written alone or with a unit of calendar year (2025, 2025年, 2025年度), and not part of an amount ($2025). */
const CALENDAR_YEAR = /(?<!\d|\d[.,])(?:1[89]|2[01])\d{2}(?!\d|[.,]\d)/gu;

const periodsOf = (doc: ProseDocument, figures: readonly Figure[]): Period[] => {
  const yearUnits = new Set(patternsOf(doc, "calendar-year-unit").map((unit) => `${unit}|`));
  const amounts = figures.filter((figure) => !yearUnits.has(figure.unit));
  return [...doc.source.matchAll(CALENDAR_YEAR)].flatMap((match) => {
    const span = { start: match.index, end: match.index + match[0].length };
    return amounts.some((figure) => figure.start < span.end && span.start < figure.end) ? [] : [{ ...span, year: Number(match[0]) }];
  });
};

const marksOf = (doc: ProseDocument, lexicon: string): BaseMark[] =>
  (doc.lexicons[lexicon] ?? []).flatMap((entry) =>
    entry.position === undefined ? [] : spansOf(doc.source, entry.pattern).map((span) => ({ ...span, position: entry.position ?? "before" })),
  );

export const changeRate: Detector = (doc): Finding[] => {
  if (doc.structure === undefined) return [];
  const nodes = quantityNodes(doc.structure);
  const units = patternsOf(doc, "percent-unit");
  const multipliers = patternsOf(doc, "amount-multiplier").map((word) => word.toLowerCase());
  const taken = nodes.map((node) => node.span);
  const figures = [...treeFigures(doc, nodes, units, multipliers), ...countedFigures(doc, taken, multipliers)];
  const text = {
    sentences: doc.sentences.map((sentence) => sentence.span),
    figures,
    rates: ratesOf(doc, nodes, units),
    directions: directionsOf(doc),
    marks: marksOf(doc, "change-base"),
    targets: marksOf(doc, "change-target"),
    periods: periodsOf(doc, figures),
    breaks: breaksOf(doc),
    source: doc.source,
  };
  return changeRateMismatches(text).map((issue) => ({
    rule: "change-rate-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
