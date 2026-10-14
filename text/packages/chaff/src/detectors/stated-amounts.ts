// The amounts a document states, as the multiple and total checks read them: currency-notation's written amounts, each
// read with amount-multiplier's words of scale (1億2,000万円 is one amount), the ones that cannot be read left out.
import type { ProseDocument } from "../plugin.ts";
import type { StatedAmount } from "../structure/stated-multiple.ts";
import { scaledAmountOf, scaleWordsOf } from "./amount-scale.ts";
import { amountsIn, formsOf } from "./currency-notation.ts";

export const statedAmountsOf = (text: string, doc: ProseDocument): StatedAmount[] => {
  const scales = scaleWordsOf(doc);
  return amountsIn(
    text,
    formsOf(doc),
    scales.map((scale) => scale.word),
  ).flatMap((amount) => {
    const read = scaledAmountOf(text, amount, scales);
    return read === undefined
      ? []
      : [{ offset: read.offset, end: amount.offset + amount.written.length, currency: read.currency, value: read.value, scale: read.unit }];
  });
};
