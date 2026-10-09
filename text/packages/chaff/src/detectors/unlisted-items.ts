// unlisted-item-used: a numbered step uses a thing the document's list of what is needed does not name
// (structure/unlisted-items.ts). The words are the language package's item-list-heading, item-use, item-amount,
// item-at-hand and enumeration-joiner.
import type { Detector, Finding, ProseDocument, Token } from "../plugin.ts";
import { itemLists, unlistedItems, type ItemStep, type ItemToken, type ItemWords, type UseGroup, type UseMarker } from "../structure/unlisted-items.ts";
import { quoteAround } from "./quote-around.ts";

const USE_GROUPS: readonly UseGroup[] = ["object", "place", "instrument"];

const patternsOf = (doc: ProseDocument, lexicon: string, group?: string): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => group === undefined || entry.group === group).map((entry) => entry.pattern);

const markersOf = (doc: ProseDocument): UseMarker[] =>
  (doc.lexicons["item-use"] ?? []).flatMap((entry) => {
    const group = USE_GROUPS.find((use) => use === entry.group);
    return group === undefined || entry.position === undefined ? [] : [{ word: entry.pattern, group, position: entry.position }];
  });

const wordsOf = (doc: ProseDocument): ItemWords => ({
  ingredientHeadings: patternsOf(doc, "item-list-heading", "ingredient"),
  toolHeadings: patternsOf(doc, "item-list-heading", "tool"),
  markers: markersOf(doc),
  verbs: Object.fromEntries(USE_GROUPS.map((group) => [group, patternsOf(doc, "item-use", `${group}-verb`)])),
  negations: patternsOf(doc, "item-use", "negation"),
  actions: patternsOf(doc, "item-use", "action"),
  joiners: patternsOf(doc, "enumeration-joiner"),
  partitives: patternsOf(doc, "item-use", "partitive"),
  amounts: patternsOf(doc, "item-amount"),
  atHand: patternsOf(doc, "item-at-hand"),
});

const NUMBERED_LINE = /^[ \t]*\d+[.)．）][ \t]+/gmu;

const itemToken = (token: Token): ItemToken => ({
  surface: token.surface,
  pos: token.pos,
  lemma: token.lemma ?? token.surface,
  start: token.span.start,
  end: token.span.end,
});

/** Each numbered line, with the words of the sentences that start on it. */
const stepsOf = (doc: ProseDocument): ItemStep[] =>
  [...doc.source.matchAll(NUMBERED_LINE)].map((match) => {
    const lineEnd = doc.source.indexOf("\n", match.index);
    const end = lineEnd === -1 ? doc.source.length : lineEnd;
    const sentences = doc.sentences.filter((sentence) => sentence.span.start >= match.index && sentence.span.start < end);
    return { start: match.index, tokens: sentences.flatMap((sentence) => (sentence.tokens ?? []).map(itemToken)) };
  });

const headingsOf = (doc: ProseDocument): string[] => doc.sections.filter((section) => section.depth > 0).map((section) => section.heading);

/** Every word the tagger read, in the text and in the table cells (a list of ingredients is often a table). */
const wordsWritten = (doc: ProseDocument): ItemToken[] => [
  ...doc.sentences.flatMap((sentence) => (sentence.tokens ?? []).map(itemToken)),
  ...(doc.tableCells?.() ?? []).flatMap((cell) => (cell.tokens ?? []).map(itemToken)),
];

export const unlistedItemUsed: Detector = (doc): Finding[] => {
  const words = wordsOf(doc);
  const headings = headingsOf(doc);
  // Reading every table cell is not free; a document without a list heading needs none of it.
  if (itemLists(headings, words).length === 0) return [];
  return unlistedItems({ source: doc.source, words: wordsWritten(doc) }, headings, stepsOf(doc), words).map((item) => ({
    rule: "unlisted-item-used",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(doc.source, item.offset, item.offset + item.item.length),
    values: { item: item.item, list: item.list, offset: item.offset },
  }));
};
