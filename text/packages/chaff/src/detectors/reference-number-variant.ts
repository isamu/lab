// reference-number-variant: a document's own reference number written with two neighbouring characters swapped somewhere
// else in the document, after a label of the same kind (reference-numbers.ts); and the document's one vehicle plate written
// once with one character of its serial changed (vehicle-plates.ts).
import { labelledReferenceNumbers, referenceVariants, type ReferenceNumber } from "../reference-numbers.ts";
import { labelledPlates, plateVariants } from "../vehicle-plates.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding } from "../plugin.ts";

const PLATE_SHAPES = "vehicle-plate";
const SUBSTITUTED = "substituted";

const finding = (number: ReferenceNumber, other: ReferenceNumber, source: string, variant?: string): Finding => ({
  rule: "",
  severity: "info",
  line: 0,
  column: 0,
  quote: quoteAt(source, number.offset),
  values: { written: number.written, other: other.written, offset: number.offset },
  ...(variant === undefined ? {} : { variant }),
});

export const referenceNumberVariant: Detector = (doc, options): Finding[] => {
  const labels = options.lexicon ?? [];
  if (labels.length === 0) return [];
  const text = doc.prose ?? doc.source;
  const plates = labelledPlates(text, labels, doc.lexicons[PLATE_SHAPES] ?? []);
  const inPlate = (number: ReferenceNumber): boolean =>
    plates.some((plate) => number.offset >= plate.offset && number.offset < plate.offset + plate.written.length);
  const numbers = [...labelledReferenceNumbers(text, labels).filter((number) => !inPlate(number)), ...plates];
  return [
    ...referenceVariants(numbers).map(({ number, other }) => finding(number, other, doc.source)),
    ...plateVariants(plates).map(({ number, other }) => finding(number, other, doc.source, SUBSTITUTED)),
  ].toSorted((a, b) => Number(a.values["offset"]) - Number(b.values["offset"]));
};
