// amount-scale-consistency: the reading half. The amounts are currency-notation's (the lexicon currency-notation says
// how a currency is written); the words of scale and their values are the lexicon amount-multiplier (weight).
import type { Detector, Finding, Lexicon, ProseDocument } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { amountValue, scaleMixes, withoutRoundTextFigures, type ScaleWord, type ScaledAmount } from "../structure/amount-scale.ts";
import { AMOUNT, amountsIn, formsOf, type WrittenAmount } from "./currency-notation.ts";
import { quoteAround } from "./quote-around.ts";
import { proseAndTablesOf } from "../table-text.ts";

/** How far back a larger part of one amount may start (1億2,000万円 is read from 2,000万円). */
const LEADING_REACH = 40;

/** How far from an amount a marker of an estimate is looked for. */
const MARKER_REACH = 12;

export const scaleWordsOf = (doc: ProseDocument): ScaleWord[] =>
  (doc.lexicons["amount-multiplier"] ?? []).flatMap((entry) => (entry.weight === undefined ? [] : [{ word: entry.pattern, value: entry.weight }]));

/** The larger parts written right before an amount the currency notation read from its last part (1億 before 2,000万円). */
const leadingParts = (text: string, offset: number, words: readonly ScaleWord[]): string => {
  if (words.length === 0) return "";
  const scales = words.map((word) => escapeRegExp(word.word)).join("|");
  const before = text.slice(Math.max(0, offset - LEADING_REACH), offset);
  return new RegExp(`(?<![0-9０-９.,，])(?:${AMOUNT}(?:${scales}))+$`, "u").exec(before)?.[0] ?? "";
};

/** The written amount without its currency mark, which is on the side its form says. */
const numberPart = (amount: WrittenAmount): string => {
  const [position = "", ...mark] = amount.form.split(":");
  const pattern = mark.join(":");
  return position === "before" ? amount.written.trimStart().slice(pattern.length) : amount.written.trimEnd().slice(0, -pattern.length);
};

/** The largest word of scale written in the number (万 in 1億2,000万 is smaller than 億), undefined when there is none. */
const unitOf = (number: string, words: readonly ScaleWord[]): number | undefined => {
  const lower = number.toLowerCase();
  const values = words.filter((word) => lower.includes(word.word.toLowerCase())).map((word) => word.value);
  return values.length === 0 ? undefined : Math.max(...values);
};

/** One written amount read as a value, with the larger parts written before it (1億 before 2,000万円). */
export const scaledAmountOf = (text: string, amount: WrittenAmount, words: readonly ScaleWord[]): ScaledAmount | undefined => {
  const leading = amount.form.startsWith("after:") ? leadingParts(text, amount.offset, words) : "";
  const written = `${leading}${amount.written}`;
  const number = `${leading}${numberPart(amount)}`;
  const value = amountValue(number, words);
  if (value === undefined) return undefined;
  return { offset: amount.offset - leading.length, written, currency: amount.currency, value, unit: unitOf(number, words) };
};

const scaledAmountsOf = (text: string, amounts: readonly WrittenAmount[], words: readonly ScaleWord[]): ScaledAmount[] =>
  amounts.flatMap((amount) => scaledAmountOf(text, amount, words) ?? []);

/** Whether a marker of an estimate (約, 程度, about) stands right before or after the amount. */
const isApproximate = (text: string, amount: ScaledAmount, markers: Lexicon): boolean => {
  const before = text
    .slice(Math.max(0, amount.offset - MARKER_REACH), amount.offset)
    .trimEnd()
    .toLowerCase();
  const after = text
    .slice(amount.offset + amount.written.length, amount.offset + amount.written.length + MARKER_REACH)
    .trimStart()
    .toLowerCase();
  return markers.some((entry) => (entry.position === "after" ? after.startsWith(entry.pattern.toLowerCase()) : before.endsWith(entry.pattern.toLowerCase())));
};

/** Whether the amount is on a table row (the text has the tables read back in, and only tables start a line with |). */
const onTableRow = (text: string, amount: ScaledAmount): boolean =>
  text
    .slice(text.lastIndexOf("\n", amount.offset) + 1)
    .trimStart()
    .startsWith("|");

export const amountScale: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  const words = scaleWordsOf(doc);
  const markers = doc.lexicons["approximate-marker"] ?? [];
  const amounts = scaledAmountsOf(
    text,
    amountsIn(
      text,
      formsOf(doc),
      words.map((word) => word.word),
    ),
    words,
  ).filter((amount) => !isApproximate(text, amount, markers));
  const mixes = withoutRoundTextFigures(scaleMixes(amounts), amounts, (amount) => onTableRow(text, amount));
  return mixes.map(({ odd, usual }) => ({
    rule: "amount-scale-consistency",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAround(text, odd.offset, odd.offset + odd.written.length),
    values: { written: odd.written.trim(), usual: usual.written.trim(), offset: odd.offset },
  }));
};
