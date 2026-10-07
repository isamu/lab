// An amount written in digits where the document writes amounts of that size with a word of scale, or the other way
// round (250,000円 beside 30万円; $2,500,000 beside $1.5 million). Small amounts in digits and large ones with 万 or
// million is one way of writing, not a mix, so only amounts of the same order of magnitude are compared. Pure.

/**
 * One amount: where it is, as written, its currency, its value, and the largest word of scale it was written with (unit:
 * 10000 for 30万円, 1000000 for $1.5 million), undefined when it was written in digits only.
 */
export type ScaledAmount = {
  readonly offset: number;
  readonly written: string;
  readonly currency: string;
  readonly value: number;
  readonly unit: number | undefined;
};

/** The amount written the other way, and the first one of its size written the usual way. */
export type ScaleMix = { readonly odd: ScaledAmount; readonly usual: ScaledAmount };

/** A digit amount with more significant digits than this (1,234,567円) is a precise figure no word of scale would write. */
const MAX_SIGNIFICANT_DIGITS = 3;

const significantDigits = (value: number): number => {
  const digits = [...String(value).replace(".", "")];
  const first = digits.findIndex((digit) => digit !== "0");
  return first < 0 ? 0 : digits.findLastIndex((digit) => digit !== "0") - first + 1;
};

const isScaled = (amount: ScaledAmount): boolean => amount.unit !== undefined;

/**
 * Whether the amount could be written the other way. A digit one when it is round (250,000, not 250,500); a scaled one when
 * it is at least one of its unit: "£0.2 million" is written to line up with larger amounts beside it, not to give a size.
 */
const comparable = (amount: ScaledAmount): boolean =>
  amount.value > 0 && (amount.unit === undefined ? significantDigits(amount.value) <= MAX_SIGNIFICANT_DIGITS : amount.value >= amount.unit);

/** The order of magnitude, from the digits of the whole part (Math.log10 is not exact at every power of ten). */
const magnitudeOf = (value: number): number => String(Math.floor(value)).length - 1;

const countScaled = (amounts: readonly ScaledAmount[]): number => amounts.filter(isScaled).length;

/** Whether the scaled way is the odd one in a size: the fewer there, then the fewer at that size and above, then the later. */
const oddIsScaled = (band: readonly ScaledAmount[], larger: readonly ScaledAmount[]): boolean => {
  const scaledInBand = countScaled(band);
  if (scaledInBand * 2 !== band.length) return scaledInBand * 2 < band.length;
  const scaledLarger = countScaled(larger);
  if (scaledLarger * 2 !== larger.length) return scaledLarger * 2 < larger.length;
  const firstScaled = band.findIndex(isScaled);
  const firstDigits = band.findIndex((amount) => !isScaled(amount));
  return firstScaled > firstDigits;
};

const mixesOfCurrency = (amounts: readonly ScaledAmount[]): ScaleMix[] => {
  const magnitudes = [...new Set(amounts.map((amount) => magnitudeOf(amount.value)))];
  return magnitudes.flatMap((magnitude) => {
    const band = amounts.filter((amount) => magnitudeOf(amount.value) === magnitude);
    const scaledIsOdd = oddIsScaled(
      band,
      amounts.filter((amount) => magnitudeOf(amount.value) >= magnitude),
    );
    const usual = band.find((amount) => isScaled(amount) !== scaledIsOdd);
    if (usual === undefined) return [];
    return band.filter((amount) => isScaled(amount) === scaledIsOdd).map((amount) => ({ odd: amount, usual }));
  });
};

/** For each currency, the amounts written the other way from the rest of their order of magnitude, in document order. */
export const scaleMixes = (amounts: readonly ScaledAmount[]): ScaleMix[] => {
  const ordered = amounts.filter(comparable).toSorted((left, right) => left.offset - right.offset);
  return [...new Set(ordered.map((amount) => amount.currency))]
    .flatMap((currency) => mixesOfCurrency(ordered.filter((amount) => amount.currency === currency)))
    .toSorted((left, right) => left.odd.offset - right.odd.offset);
};

/** The largest number of significant digits a round figure has (130万円, $1.5 million): a rounded total or a cap. */
const ROUND_DIGITS = 2;

/**
 * Leaves out a round figure in the text (約130万円, a cap of $1.5 million) whose only evidence is the exact amounts of a
 * table, none of them the same amount: the text gives the round size and the table the detail, which is not one amount
 * written two ways. The same amount in the table (220万円 and 2,200,000円) stays a mix, and so does a mix within the text.
 */
export const withoutRoundTextFigures = (mixes: readonly ScaleMix[], amounts: readonly ScaledAmount[], inTable: (amount: ScaledAmount) => boolean): ScaleMix[] =>
  mixes.filter(({ odd }) => {
    if (inTable(odd) || significantDigits(odd.value) > ROUND_DIGITS) return true;
    const others = amounts.filter(
      (amount) =>
        comparable(amount) && amount.currency === odd.currency && magnitudeOf(amount.value) === magnitudeOf(odd.value) && isScaled(amount) !== isScaled(odd),
    );
    return others.some((amount) => !inTable(amount) || amount.value === odd.value);
  });

/** A word of scale and the value it multiplies by (万 10000, million 1000000). */
export type ScaleWord = { readonly word: string; readonly value: number };

const NUMBER_THEN_WORD = /(\d+(?:,\d{3})*(?:\.\d+)?)\s?([^\s\d.,]*)/gu;

/**
 * The value of an amount as written, without its currency: 1億2,000万 is 120000000, 1.5 million is 1500000. Undefined when a
 * part is followed by a word that is not one of scale, or nothing is read.
 */
export const amountValue = (written: string, words: readonly ScaleWord[]): number | undefined => {
  const parts = [...written.normalize("NFKC").matchAll(NUMBER_THEN_WORD)];
  if (parts.length === 0) return undefined;
  const values = parts.map((part) => {
    const number = Number((part[1] ?? "").replaceAll(",", ""));
    const word = (part[2] ?? "").toLowerCase();
    if (word === "") return number;
    const scale = words.find((entry) => entry.word.toLowerCase() === word);
    return scale === undefined ? Number.NaN : number * scale.value;
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number.isFinite(total) ? total : undefined;
};
