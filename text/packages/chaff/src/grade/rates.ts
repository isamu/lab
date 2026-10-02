import { lengthOf } from "../measure.ts";
import { tally } from "./order.ts";
import type { LengthUnit, ProseDocument } from "../plugin.ts";

/** An output's length in the unit lint measures sentences in: characters for Japanese, words for English. */
export type OutputSize = { readonly unit: LengthUnit; readonly value: number };

/** Rates are findings per this many units, so a short and a long output are measured alike. */
export const RATE_BASE = 1000;

const RATE_DECIMALS = 1;

export const sizeOf = (doc: Pick<ProseDocument, "sentences" | "lengthUnit">): OutputSize => ({
  unit: doc.lengthUnit,
  value: doc.sentences.reduce((sum, sentence) => sum + lengthOf(sentence, doc.lengthUnit), 0),
});

const rounded = (value: number): number => {
  const scale = 10 ** RATE_DECIMALS;
  return Math.round(value * scale) / scale;
};

/** Findings per RATE_BASE units. Undefined for an output with no length: a rate over nothing is not zero. */
export const rateOf = (count: number, size: number): number | undefined => (size > 0 ? rounded((count * RATE_BASE) / size) : undefined);

/** Each rule's rate over one output. An output with no length gets none, its findings still listed. */
export const ratesOf = (rules: readonly string[], size: OutputSize): Record<string, number> =>
  Object.fromEntries(
    Object.entries(tally(rules)).flatMap(([rule, count]) => {
      const rate = rateOf(count, size.value);
      return rate === undefined ? [] : [[rule, rate]];
    }),
  );
