import { lengthOf } from "../measure.ts";
import { lineStarts, placeOf } from "../position.ts";
import type { LengthUnit, ProseDocument, Section, Sentence } from "../plugin.ts";
import { coversOffset, spanIndex } from "../compare/spans.ts";

/** One section: its heading's depth (0 for the text before the first heading), its words, its line, and its own length. */
export type OutlineEntry = { readonly depth: number; readonly heading: string; readonly line: number; readonly length: number };

/** The measures a restructure moves. Lengths are in the document's unit: characters for Japanese, words for English. */
export type Shape = {
  readonly headings: number;
  /** The mean length of the sections that have text, rounded. */
  readonly averageSectionLength: number;
  /** The share of the body text inside list items, as a rounded percentage. */
  readonly listPercent: number;
  /** Bold spans (Markdown `**…**`). */
  readonly bold: number;
};

export type Outline = { readonly unit: LengthUnit; readonly entries: readonly OutlineEntry[]; readonly shape: Shape };

const PERCENT = 100;

const lengthOfAll = (sentences: readonly Sentence[], unit: LengthUnit): number => sentences.reduce((sum, sentence) => sum + lengthOf(sentence, unit), 0);

/** The text before the first heading is listed only when there is some: a title line alone has nothing above it. */
const isListed = (entry: OutlineEntry): boolean => entry.depth > 0 || entry.length > 0;

/** Where each heading starts, keyed by where it ends: a section begins after its heading, past a Setext underline. */
type HeadingStarts = ReadonlyMap<number, number>;

const headingStartsOf = (doc: ProseDocument): HeadingStarts => new Map((doc.markup?.headings ?? []).map((heading) => [heading.end, heading.start]));

/** A heading's first line; for the text above the first heading, the line its text starts on, below any front matter. */
const startOf = (section: Section, headingStarts: HeadingStarts): number =>
  section.depth === 0 ? (section.sentences[0]?.span.start ?? section.span.start) : (headingStarts.get(section.span.start) ?? section.span.start);

type Place = { readonly lineOf: (offset: number) => number; readonly headingStarts: HeadingStarts };

const entryOf = (section: Section, unit: LengthUnit, place: Place): OutlineEntry => ({
  depth: section.depth,
  heading: section.heading,
  line: place.lineOf(startOf(section, place.headingStarts)),
  length: lengthOfAll(section.sentences, unit),
});

const averageOf = (lengths: readonly number[]): number =>
  lengths.length === 0 ? 0 : Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length);

const listPercentOf = (doc: ProseDocument): number => {
  const lists = spanIndex(doc.listSpans);
  const total = lengthOfAll(doc.sentences, doc.lengthUnit);
  const inLists = lengthOfAll(
    doc.sentences.filter((sentence) => coversOffset(lists, sentence.span.start)),
    doc.lengthUnit,
  );
  return total === 0 ? 0 : Math.round((inLists / total) * PERCENT);
};

/** The document's outline and its shape, measured from the same reading lint uses. */
export const outlineOf = (doc: ProseDocument): Outline => {
  const starts = lineStarts(doc.source);
  const place: Place = { lineOf: (offset) => placeOf(starts, offset).line, headingStarts: headingStartsOf(doc) };
  const entries = doc.sections.map((section) => entryOf(section, doc.lengthUnit, place)).filter(isListed);
  const shape: Shape = {
    headings: entries.filter((entry) => entry.depth > 0).length,
    averageSectionLength: averageOf(entries.map((entry) => entry.length).filter((length) => length > 0)),
    listPercent: listPercentOf(doc),
    bold: doc.sections.reduce((sum, section) => sum + section.strongCount, 0),
  };
  return { unit: doc.lengthUnit, entries, shape };
};
