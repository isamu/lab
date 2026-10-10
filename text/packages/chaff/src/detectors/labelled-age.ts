// An age beside a labelled date of birth, compared with the exact age on a labelled reference date (elapsed-years-mismatch).
import type { Finding, LexiconEntry, ProseDocument, Span, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { quoteAt } from "./structure-tree.ts";
import { calendarDateOf } from "../derived/date-arithmetic.ts";
import {
  ageMismatches,
  ageVerdicts,
  agesIn,
  labelAfter,
  labelBefore,
  type AgeWords,
  type LabelledBirth,
  type LabelWord,
  type LabelledReference,
} from "../derived/age-on-date.ts";

type DateNode = Span & { readonly value: string };

const entriesOf = (doc: ProseDocument, id: string): readonly LexiconEntry[] => doc.lexicons[id] ?? [];

const patternsAt = (doc: ProseDocument, id: string, position: "before" | "after"): string[] =>
  entriesOf(doc, id)
    .filter((entry) => (entry.position ?? "before") === position)
    .map((entry) => entry.pattern);

const ageWords = (doc: ProseDocument): AgeWords => ({
  before: patternsAt(doc, "age-marker", "before"),
  after: [...patternsAt(doc, "age-marker", "after"), ...entriesOf(doc, "age-unit").map((entry) => entry.pattern)],
  skip: entriesOf(doc, "duration-year").map((entry) => entry.pattern),
  approximateBefore: patternsAt(doc, "approximate-marker", "before"),
  approximateAfter: patternsAt(doc, "approximate-marker", "after"),
});

const datesOf = (tree: StructureNode): DateNode[] =>
  inDocumentOrder(tree).flatMap((node) => (node.kind === "date" ? [{ ...node.span, value: String(node.attrs["value"]) }] : []));

const lineStartOf = (source: string, at: number): number => source.lastIndexOf("\n", at - 1) + 1;

const lineEndOf = (source: string, at: number): number => {
  const end = source.indexOf("\n", at);
  return end === -1 ? source.length : end;
};

const isFullDate = (value: string): boolean => calendarDateOf(value)?.year !== undefined;

/** The age after a labelled date of birth, up to the next date on the line or its end: one age, or none. */
const birthOf = (doc: ProseDocument, date: DateNode, dates: readonly DateNode[]): LabelledBirth[] => {
  if (
    !isFullDate(date.value) ||
    labelBefore(doc.source.slice(lineStartOf(doc.source, date.start), date.start), entriesOf(doc, "birth-date-label")) === undefined
  )
    return [];
  const lineEnd = lineEndOf(doc.source, date.end);
  const regionEnd = Math.min(lineEnd, ...dates.filter((other) => other.start >= date.end).map((other) => other.start));
  const region = doc.source.slice(date.end, regionEnd);
  const ages = agesIn(region, ageWords(doc));
  const [age] = ages;
  if (ages.length !== 1 || age === undefined) return [];
  const lead = region.slice(0, age.start).toLowerCase();
  const tail = region.slice(age.end).trimStart().toLowerCase();
  const mark = entriesOf(doc, "age-time-mark").find((entry) => lead.includes(entry.pattern.toLowerCase()) || tail.startsWith(entry.pattern.toLowerCase()));
  return [{ start: date.start, end: date.end, birth: date.value, age: { ...age, start: date.end + age.start, end: date.end + age.end }, group: mark?.group }];
};

const ownLabel = (doc: ProseDocument, date: DateNode): LabelWord | undefined => {
  const labels = entriesOf(doc, "age-reference-label");
  return (
    labelBefore(doc.source.slice(lineStartOf(doc.source, date.start), date.start), labels) ??
    labelAfter(doc.source.slice(date.end, lineEndOf(doc.source, date.end)), labels)
  );
};

/** Dates with a reference label. A later date on the same line without a label of its own takes the label before it
 * ("Examination date: March 1, 2026 and March 3, 2026" is two examination dates, and the age is then undecided). */
const referencesOf = (doc: ProseDocument, dates: readonly DateNode[]): LabelledReference[] => {
  const labelled = dates.reduce<{ readonly line: number; readonly label: LabelWord | undefined; readonly found: LabelledReference[] }>(
    (state, date) => {
      const line = lineStartOf(doc.source, date.start);
      const label = ownLabel(doc, date) ?? (line === state.line ? state.label : undefined);
      if (label !== undefined && isFullDate(date.value))
        state.found.push({ start: date.start, end: date.end, date: date.value, group: label.group ?? label.pattern });
      return { line, label, found: state.found };
    },
    { line: -1, label: undefined, found: [] },
  );
  return labelled.found;
};

const recordsOf = (doc: ProseDocument, tree: StructureNode): { births: LabelledBirth[]; references: LabelledReference[] } => {
  const dates = datesOf(tree);
  return { births: dates.flatMap((date) => birthOf(doc, date, dates)), references: referencesOf(doc, dates) };
};

/** Where the ages whose reference date was decided start: the year-only check stays silent on them. */
export const decidedAgeStarts = (doc: ProseDocument, tree: StructureNode): ReadonlySet<number> => {
  const { births, references } = recordsOf(doc, tree);
  return new Set(ageVerdicts(births, references).map((verdict) => verdict.birth.age.start));
};

const written = (doc: ProseDocument, span: Span): string => doc.source.slice(span.start, span.end);

export const labelledAgeFindings = (doc: ProseDocument, tree: StructureNode): Finding[] => {
  const { births, references } = recordsOf(doc, tree);
  return ageMismatches(births, references).map(({ birth, reference, expected }) => ({
    rule: "elapsed-years-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, birth.age.start),
    variant: "birth-date",
    values: { written: written(doc, birth.age), birth: written(doc, birth), reference: written(doc, reference), expected, offset: birth.age.start },
  }));
};
