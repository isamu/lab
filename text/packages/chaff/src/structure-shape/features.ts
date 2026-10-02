import { lengthOf } from "../measure.ts";
import type { Lexicon, ProseDocument, Section, Sentence } from "../plugin.ts";
import { coefficientOfVariation } from "../detectors/structure.ts";
import { boldLabelItems } from "../detectors/bold-label.ts";
import { MIN_DOCUMENT_LENGTH } from "../detectors/signals.ts";
import { bookendOf, headingFormOf, headingWords, proConPairs } from "./heading-words.ts";
import { restatementPercent } from "./restatement.ts";

/** The structure measures, in the order they are shown. */
export const FEATURE_IDS = [
  "heading-density",
  "short-sections",
  "section-uniformity",
  "heading-forms",
  "three-subsections",
  "bookends",
  "closing-restatement",
  "three-item-lists",
  "bold-labels",
  "emoji-headings",
  "pro-con",
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

/** Which way a value moves away from human writing: higher (more headings) or lower (more uniform sections). */
export type Direction = "high" | "low";

export const DIRECTION: Readonly<Record<FeatureId, Direction>> = {
  "heading-density": "high",
  "short-sections": "high",
  "section-uniformity": "low",
  "heading-forms": "high",
  "three-subsections": "high",
  bookends: "high",
  "closing-restatement": "high",
  "three-item-lists": "high",
  "bold-labels": "high",
  "emoji-headings": "high",
  "pro-con": "high",
};

/** Why a measure has no value for this document. */
export type NotMeasured = "too-short" | "too-few-sections" | "too-few-headings" | "no-closing" | "too-few-lists";

/** One measure: its value, or why it has none, and what it found (the forms, the pairs) to show beside the number. */
export type FeatureValue = {
  readonly id: FeatureId;
  readonly value: number | undefined;
  readonly notMeasured?: NotMeasured;
  readonly detail?: string;
  /** The count behind a rate: the section headings behind the heading density. */
  readonly count?: number;
};

const PER = 1000;
const PERCENT = 100;
const MIN_SECTIONS = 5;
const MIN_SHORT_SECTIONS = 3;
const MIN_HEADINGS = 4;
const MIN_BOOKEND_HEADINGS = 2;
const MIN_LISTS = 3;
/** One or two paragraphs: a section that is a heading over a paragraph, the shape of a heading every paragraph or two. */
const SHORT_SECTION_PARAGRAPHS = 2;
const THREE = 3;

const EMOJI = /\p{Extended_Pictographic}/u;

const measured = (id: FeatureId, value: number, detail?: string): FeatureValue => ({
  id,
  value,
  ...(detail === undefined || detail === "" ? {} : { detail }),
});
const notMeasured = (id: FeatureId, why: NotMeasured): FeatureValue => ({ id, value: undefined, notMeasured: why });

const roundTo1 = (value: number): number => Math.round(value * 10) / 10;
const percentOf = (part: number, whole: number): number => Math.round((part / whole) * PERCENT);

const lengthOfAll = (sentences: readonly Sentence[], doc: ProseDocument): number =>
  sentences.reduce((sum, sentence) => sum + lengthOf(sentence, doc.lengthUnit), 0);

/** The sections under a heading, without the title: the first heading when it is a top-level one that comes before any other. */
export const headedSections = (sections: readonly Section[]): Section[] => {
  const headed = sections.filter((section) => section.depth > 0);
  return headed[0]?.depth === 1 ? headed.slice(1) : headed;
};

const headingDensity = (doc: ProseDocument, headed: readonly Section[]): FeatureValue => {
  const length = lengthOfAll(doc.sentences, doc);
  if (length < MIN_DOCUMENT_LENGTH[doc.lengthUnit]) return notMeasured("heading-density", "too-short");
  return { ...measured("heading-density", roundTo1((headed.length / length) * PER)), count: headed.length };
};

const paragraphsIn = (doc: ProseDocument, section: Section): number =>
  doc.paragraphs.filter((paragraph) => paragraph.span.start >= section.span.start && paragraph.span.start < section.span.end).length;

const shortSections = (doc: ProseDocument, headed: readonly Section[]): FeatureValue => {
  const counts = headed.filter((section) => section.sentences.length > 0).map((section) => paragraphsIn(doc, section));
  if (counts.length < MIN_SHORT_SECTIONS) return notMeasured("short-sections", "too-few-sections");
  const short = counts.filter((count) => count <= SHORT_SECTION_PARAGRAPHS).length;
  const mean = roundTo1(counts.reduce((sum, count) => sum + count, 0) / counts.length);
  return measured("short-sections", percentOf(short, counts.length), String(mean));
};

const sectionUniformity = (doc: ProseDocument): FeatureValue => {
  const lengths = doc.sections.map((section) => lengthOfAll(section.sentences, doc)).filter((length) => length > 0);
  const cv = lengths.length < MIN_SECTIONS ? undefined : coefficientOfVariation(lengths);
  return cv === undefined ? notMeasured("section-uniformity", "too-few-sections") : measured("section-uniformity", Math.round(cv * PERCENT));
};

const lexiconOf = (doc: ProseDocument, id: string): Lexicon => doc.lexicons[id] ?? [];

/** The most common of the forms found, by its pattern: what the headings were cast in. */
const mostCommon = (forms: readonly string[]): string | undefined => {
  const counts = forms.reduce((tally, form) => tally.set(form, (tally.get(form) ?? 0) + 1), new Map<string, number>());
  return [...counts.entries()].toSorted((left, right) => right[1] - left[1])[0]?.[0];
};

const headingForms = (doc: ProseDocument, words: readonly string[]): FeatureValue => {
  const bookends = lexiconOf(doc, "bookend-heading");
  const body = words.filter((heading) => bookendOf(heading, bookends) === undefined);
  if (body.length < MIN_HEADINGS) return notMeasured("heading-forms", "too-few-headings");
  const forms = body.flatMap((heading) => headingFormOf(heading, lexiconOf(doc, "heading-form"))?.pattern ?? []);
  return measured("heading-forms", percentOf(forms.length, body.length), mostCommon(forms));
};

/** How many headings directly under each heading: the next deeper level, up to the next heading as high as itself. */
export const childCounts = (headed: readonly Section[]): number[] =>
  headed.map((section, index) => {
    const after = headed.slice(index + 1);
    const end = after.findIndex((other) => other.depth <= section.depth);
    return (end < 0 ? after : after.slice(0, end)).filter((other) => other.depth === section.depth + 1).length;
  });

/** Headings split into exactly three subheadings: the outline's own rule of three (課題が 3 つ、対策が 3 つ). */
const threeSubsections = (headed: readonly Section[]): FeatureValue =>
  measured("three-subsections", childCounts(headed).filter((count) => count === THREE).length);

const bookends = (doc: ProseDocument, words: readonly string[]): FeatureValue => {
  if (words.length < MIN_BOOKEND_HEADINGS) return notMeasured("bookends", "too-few-headings");
  const sides = new Set(words.map((heading) => bookendOf(heading, lexiconOf(doc, "bookend-heading"))).filter((side) => side !== undefined));
  return measured("bookends", sides.size, [...sides].join(","));
};

const sentencesText = (sentences: readonly Sentence[]): string => sentences.map((sentence) => sentence.text).join("\n");

/** The last closing bookend (まとめ, Conclusion) that has text, compared with everything written before it. */
const closingRestatement = (doc: ProseDocument, headed: readonly Section[]): FeatureValue => {
  const lexicon = lexiconOf(doc, "bookend-heading");
  const closing = headed.findLast((section) => section.sentences.length > 0 && bookendOf(headingWords(section.heading), lexicon) === "after");
  if (closing === undefined) return notMeasured("closing-restatement", "no-closing");
  const body = doc.sentences.filter((sentence) => sentence.span.start < closing.span.start);
  const percent = restatementPercent(sentencesText(closing.sentences), sentencesText(body), doc.lengthUnit);
  return percent === undefined ? notMeasured("closing-restatement", "no-closing") : measured("closing-restatement", percent, closing.heading);
};

const threeItemLists = (doc: ProseDocument): FeatureValue => {
  if (doc.lists.length < MIN_LISTS) return notMeasured("three-item-lists", "too-few-lists");
  const threes = doc.lists.filter((list) => list.items.length === THREE).length;
  return measured("three-item-lists", percentOf(threes, doc.lists.length), `${String(threes)}/${String(doc.lists.length)}`);
};

const emojiHeadings = (doc: ProseDocument): FeatureValue =>
  measured("emoji-headings", doc.sections.filter((section) => section.depth > 0 && EMOJI.test(section.heading)).length);

const proCon = (doc: ProseDocument, words: readonly string[]): FeatureValue => {
  if (words.length < MIN_BOOKEND_HEADINGS) return notMeasured("pro-con", "too-few-headings");
  const pairs = proConPairs(words, lexiconOf(doc, "pro-con-heading"));
  return measured("pro-con", pairs.length, pairs.join(", "));
};

/** Every structure measure of one document, in FEATURE_IDS order. Reads only the document: no baseline, no judgement. */
export const structureFeaturesOf = (doc: ProseDocument): FeatureValue[] => {
  const headed = headedSections(doc.sections);
  const words = headed.map((section) => headingWords(section.heading));
  return [
    headingDensity(doc, headed),
    shortSections(doc, headed),
    sectionUniformity(doc),
    headingForms(doc, words),
    threeSubsections(headed),
    bookends(doc, words),
    closingRestatement(doc, headed),
    threeItemLists(doc),
    measured("bold-labels", boldLabelItems(doc).length),
    emojiHeadings(doc),
    proCon(doc, words),
  ];
};
