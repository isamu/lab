// Figures and tables referred to out of numeric order, first referred to only a section after they appear, or never
// referred to while their siblings are. Pure; the figure words come from the language's figure-label lexicon.
import { figureMentions, type Mention as FigureMention } from "../figure-references.ts";
import { labelWordsOf } from "./dangling-figure.ts";
import { figureListMentions, figureListWordsOf } from "./figure-number-list.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding, ProseDocument } from "../plugin.ts";

export type FigureOrderSlip =
  | { readonly variant: "order"; readonly offset: number; readonly label: string; readonly after: string }
  | { readonly variant: "late"; readonly offset: number; readonly label: string }
  | { readonly variant: "unreferenced"; readonly offset: number; readonly label: string };

/** The number as a tuple to compare (3 → [3], 3.2 → [3, 2]); undefined for letters and kanji numerals, which are not ordered here. */
export const numberOf = (mention: FigureMention): readonly number[] | undefined => {
  const number = mention.key.slice(mention.key.indexOf("\u0000") + 1).replace(/[-－]/gu, ".");
  return /^\d+(?:\.\d+)*$/u.test(number) ? number.split(".").map(Number) : undefined;
};

const compare = (left: readonly number[], right: readonly number[]): number => {
  const differs = left.findIndex((part, index) => part !== (right[index] ?? -1));
  if (differs === -1) return left.length - right.length;
  return (left[differs] ?? 0) - (right[differs] ?? -1);
};

/** The first mention of each figure, by its key, in document order. */
const firstByKey = (mentions: readonly FigureMention[]): Map<string, FigureMention> =>
  mentions.reduce((first, mention) => (first.has(mention.key) ? first : first.set(mention.key, mention)), new Map<string, FigureMention>());

/** Each first reference whose number is lower than one of its kind first referred to earlier. */
export const outOfOrder = (references: readonly FigureMention[]): FigureOrderSlip[] => {
  const highest = new Map<string, { readonly number: readonly number[]; readonly written: string }>();
  return [...firstByKey(references).values()].flatMap((mention): FigureOrderSlip[] => {
    const number = numberOf(mention);
    if (number === undefined) return [];
    const before = highest.get(mention.kind);
    if (before !== undefined && compare(number, before.number) < 0)
      return [{ variant: "order", offset: mention.start, label: mention.written, after: before.written }];
    highest.set(mention.kind, { number, written: mention.written });
    return [];
  });
};

/**
 * Each captioned figure first referred to only after a heading that follows its caption, and each captioned figure never
 * referred to, when the document refers to another of its kind (so it is the kind of document that refers to its figures).
 */
export const placementSlips = (
  captions: readonly FigureMention[],
  references: readonly FigureMention[],
  headingStarts: readonly number[],
  inTextKinds: ReadonlySet<string>,
): FigureOrderSlip[] => {
  const referredKinds = new Set(references.map((mention) => mention.kind));
  const firstReference = firstByKey(references);
  const firstCaptions = [...firstByKey(captions).values()].filter((mention) => inTextKinds.has(mention.kind));
  return firstCaptions.flatMap((caption): FigureOrderSlip[] => {
    const first = firstReference.get(caption.key);
    if (first === undefined) return referredKinds.has(caption.kind) ? [{ variant: "unreferenced", offset: caption.start, label: caption.written }] : [];
    const headingBetween = headingStarts.some((start) => caption.end < start && start < first.start);
    return headingBetween ? [{ variant: "late", offset: first.start, label: first.written }] : [];
  });
};

/** A heading that opens with one of words, in any case; a Latin word whole: "Appendix A", "APPENDICES", not "Annexation". */
const opensWith = (heading: string, words: readonly string[]): boolean => {
  const text = heading.trimStart().toLowerCase();
  const wholeWord = (word: string): boolean => !/[a-z]/iu.test(word) || !/[\p{L}\p{N}]/u.test(text.charAt(word.length));
  return words.some((word) => text.startsWith(word.toLowerCase()) && wholeWord(word));
};

/**
 * Where the appendices start: the first heading that opens with a label of a kind not placed in the text (Appendix,
 * Appendices, 付録). A paper numbers its appendix tables on from the text's and refers to them from the text first.
 */
export const appendixStart = (headings: readonly { readonly text: string; readonly start: number }[], endWords: readonly string[]): number | undefined =>
  headings.find((heading) => opensWith(heading.text, endWords))?.start;

/** The figures captioned only in the appendices; a number captioned in the text too (numbering restarted) stays the text's. */
export const appendixKeys = (captions: readonly FigureMention[], start: number | undefined): ReadonlySet<string> => {
  if (start === undefined) return new Set();
  const inText = new Set(captions.filter((caption) => caption.start < start).map((caption) => caption.key));
  return new Set(captions.filter((caption) => caption.start > start && !inText.has(caption.key)).map((caption) => caption.key));
};

/** The words of the labels of a kind not placed in the text, singular and plural (Appendix, Appendices, 付録). */
const endWordsOf = (doc: ProseDocument, inTextKinds: ReadonlySet<string>): string[] =>
  [...(doc.lexicons["figure-label"] ?? []), ...(doc.lexicons["figure-label-plural"] ?? [])]
    .filter((entry) => !inTextKinds.has(entry.instead_of ?? entry.pattern))
    .map((entry) => entry.pattern);

/**
 * The text's figures in one series, and the appendices' in another: an appendix figure is ordered only by the references
 * inside the appendices, since the text refers to them first and in any order.
 */
const orderSlips = (references: readonly FigureMention[], inAppendix: ReadonlySet<string>, start: number | undefined): FigureOrderSlip[] => [
  ...outOfOrder(references.filter((mention) => !inAppendix.has(mention.key))),
  ...outOfOrder(references.filter((mention) => inAppendix.has(mention.key) && start !== undefined && mention.start > start)),
];

export const figureOrderSlips = (doc: ProseDocument): FigureOrderSlip[] => {
  const prose = doc.prose ?? doc.source;
  const { captions, references: singular } = figureMentions(doc.source, prose, labelWordsOf(doc), doc.links);
  // A plural reference counts only for a figure it names exactly: "Tables 3-5" may be a range or Table 3-5.
  const captionedKeys = new Set(captions.map((mention) => mention.key));
  const plural = figureListMentions(prose, figureListWordsOf(doc), doc.links).filter((mention) => captionedKeys.has(mention.key));
  const references = [...singular, ...plural].toSorted((left, right) => left.start - right.start);
  const headingStarts = (doc.markup?.headings ?? []).map((heading) => heading.start);
  const inTextKinds = new Set((doc.lexicons["figure-in-text"] ?? []).map((entry) => entry.pattern));
  const start = appendixStart(doc.markup?.headings ?? [], endWordsOf(doc, inTextKinds));
  const slips = [...orderSlips(references, appendixKeys(captions, start), start), ...placementSlips(captions, references, headingStarts, inTextKinds)];
  return slips.toSorted((left, right) => left.offset - right.offset);
};

export const figureOrder: Detector = (doc): Finding[] =>
  figureOrderSlips(doc).map((slip) => ({
    rule: "figure-reference-order",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, slip.offset),
    values: { label: slip.label, after: slip.variant === "order" ? slip.after : "", offset: slip.offset },
    variant: slip.variant,
  }));
