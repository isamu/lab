// reference-number-variant: a document's own reference number written with two neighbouring characters swapped somewhere
// else in the document, after a label of the same kind (reference-numbers.ts), or with no label where only one labelled
// code swaps to it (unlabelled-references.ts), or as the one code a product document is about (subject-codes.ts); and the document's one vehicle plate written
// once with one character of its serial changed (vehicle-plates.ts).
import { labelledReferenceNumbers, referenceVariants, type ReferenceNumber, type ReferenceVariant } from "../reference-numbers.ts";
import { labelledPlates, plateVariants } from "../vehicle-plates.ts";
import { isCodeWith, tableCodes, tableLabelledCodes, unlabelledVariants } from "../unlabelled-references.ts";
import { isSubjectCode, MIN_SUBJECT_DIGITS, subjectCodeVariants } from "../subject-codes.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding, OptionValue, ProseDocument } from "../plugin.ts";

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

/** Kinds a document lists many of (item codes): two labelled ones are two things, so only a code with no label is compared with them. */
const listedKindsOf = (value: OptionValue | undefined): readonly string[] => (typeof value === "object" ? value : []);

const TITLE_DEPTH = 1;

/** The title as the source writes it, where it starts: the prose masks a heading's line. */
const titleOf = (doc: ProseDocument): { start: number; text: string } | undefined => {
  const title = doc.markup?.headings.find((heading) => heading.depth === TITLE_DEPTH);
  return title === undefined ? undefined : { start: title.start, text: doc.source.slice(title.start, title.end) };
};

/** One finding per place, the first reading kept: a code may be read both as an unlabelled item code and as the document's own. */
const firstAtEachOffset = (variants: readonly ReferenceVariant[]): ReferenceVariant[] =>
  variants.filter((variant, index) => variants.findIndex((other) => other.number.offset === variant.number.offset) === index);

export const referenceNumberVariant: Detector = (doc, options): Finding[] => {
  const labels = options.lexicon ?? [];
  if (labels.length === 0) return [];
  const text = doc.prose ?? doc.source;
  const plates = labelledPlates(text, labels, doc.lexicons[PLATE_SHAPES] ?? []);
  const inPlate = (number: ReferenceNumber): boolean =>
    plates.some((plate) => number.offset >= plate.offset && number.offset < plate.offset + plate.written.length);
  const numbers = [...labelledReferenceNumbers(text, labels).filter((number) => !inPlate(number)), ...plates];
  const listed = new Set(listedKindsOf(options.settings?.["listed_kinds"]));
  const withTables = proseAndTablesOf(doc);
  const labelled = [...numbers, ...tableLabelledCodes(withTables, labels)];
  const subjectCodes = subjectCodeVariants({
    prose: text,
    title: titleOf(doc),
    labels,
    listed,
    tabled: tableLabelledCodes(withTables, labels, isSubjectCode),
    known: tableCodes(withTables, isCodeWith(MIN_SUBJECT_DIGITS)),
  });
  const unlabelled = firstAtEachOffset([...unlabelledVariants(text, labelled, tableCodes(withTables)), ...subjectCodes]);
  return [
    ...referenceVariants(numbers.filter((number) => !listed.has(number.label))).map(({ number, other }) => finding(number, other, doc.source)),
    ...unlabelled.map(({ number, other }) => finding(number, other, doc.source)),
    ...plateVariants(plates).map(({ number, other }) => finding(number, other, doc.source, SUBSTITUTED)),
  ].toSorted((a, b) => Number(a.values["offset"]) - Number(b.values["offset"]));
};
