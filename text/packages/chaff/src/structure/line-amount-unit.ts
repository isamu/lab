/**
 * 明細の一行で、数量と単価が同じ単位を数えているか。単価が何かあたり（$100/hour、月額、Rate の列）なら、数量はその単位で
 * 書かれているか単位の無い数でなければ、掛けても金額にならない。語はすべて語彙表から来る。Pure.
 */
export type UnitWord = { readonly pattern: string; readonly unit: string };

/** The marks of a price cell with its per-unit mark taken off, and the unit it named. */
export type PerUnitPrice = { readonly before: string; readonly after: string; readonly unit: string };

const longestFirst = (words: readonly UnitWord[]): UnitWord[] => words.toSorted((left, right) => right.pattern.length - left.pattern.length);

const lower = (text: string): string => text.normalize("NFKC").toLowerCase();

/** "$" "/hour" → "$" "" hour; "月額" "円" → "" "円" month. Undefined when neither mark says a unit. */
export const perUnitPrice = (before: string, after: string, marks: readonly UnitWord[]): PerUnitPrice | undefined => {
  const sorted = longestFirst(marks);
  const ending = sorted.find((mark) => lower(after).endsWith(lower(mark.pattern)));
  if (ending !== undefined) return { before, after: after.slice(0, after.length - ending.pattern.length).trim(), unit: ending.unit };
  const opening = sorted.find((mark) => lower(before).startsWith(lower(mark.pattern)));
  return opening === undefined ? undefined : { before: before.slice(opening.pattern.length).trim(), after, unit: opening.unit };
};

/** The unit of a quantity's word ("days" → day), "" when the cell has no word after its number, undefined when the word is not a unit. */
export const quantityUnit = (word: string, units: readonly UnitWord[]): string | undefined => {
  const wanted = lower(word).trim().replace(/\.$/u, "");
  if (wanted === "") return "";
  return units.find((unit) => lower(unit.pattern) === wanted)?.unit;
};

/**
 * Whether quantity × price is meaningful. A price that is per no unit is per whatever the quantity counts. A price per a
 * unit goes with a bare number (a count of that unit) or a quantity in that unit, and with nothing else.
 */
export const unitsAgree = (quantity: string | undefined, pricePer: string | undefined): boolean =>
  pricePer === undefined || quantity === "" || quantity === pricePer;

/**
 * The unit a price heading is per. A heading that names no unit a quantity counts (Rate, whose period is unstated) is per
 * the quantity heading's unit when that is one a price can be per (Hours, Miles); otherwise it stays as it is, so a bare
 * Rate beside a plain Quantity column is still not multiplied by "2 days".
 */
export const priceHeadingUnit = (priceUnit: string | undefined, quantityHeadingUnit: string | undefined, rateUnits: readonly string[]): string | undefined => {
  if (priceUnit === undefined || rateUnits.includes(priceUnit)) return priceUnit;
  return quantityHeadingUnit !== undefined && rateUnits.includes(quantityHeadingUnit) ? quantityHeadingUnit : priceUnit;
};
