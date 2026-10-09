// required-listed-as-preferred: the same skill under a required heading or label and again under a preferred one
// (structure/requirement-lists.ts). The headings and labels are requirement-heading's; the length of experience is read
// with requirement-length-unit, requirement-length-word and number-word; requirement-item-ending ends an item.
import type { Detector, Finding, ProseDocument, Span } from "../plugin.ts";
import { requiredListedAsPreferred, type RequirementBlock, type RequirementWords, type ValuedWord } from "../structure/requirement-lists.ts";
import { quoteAround } from "./quote-around.ts";

const patternsOf = (doc: ProseDocument, lexicon: string, group?: string): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => group === undefined || entry.group === group).map((entry) => entry.pattern);

const valuedOf = (doc: ProseDocument, lexicon: string, group?: string): ValuedWord[] =>
  (doc.lexicons[lexicon] ?? []).flatMap((entry) =>
    entry.weight === undefined || (group !== undefined && entry.group !== group) ? [] : [{ word: entry.pattern, value: entry.weight }],
  );

const wordsOf = (doc: ProseDocument): RequirementWords => ({
  required: patternsOf(doc, "requirement-heading", "required"),
  preferred: patternsOf(doc, "requirement-heading", "preferred"),
  units: valuedOf(doc, "requirement-length-unit"),
  before: patternsOf(doc, "requirement-length-word", "before"),
  after: patternsOf(doc, "requirement-length-word", "after"),
  numbers: valuedOf(doc, "number-word", "digit"),
  endings: patternsOf(doc, "requirement-item-ending"),
});

const LIST_MARKER = /^\s*(?:[-*+・•]|\d+[.)．）])\s+(?:\[[ xX]\]\s+)?/u;

const headingsOf = (doc: ProseDocument): RequirementBlock[] =>
  doc.sections
    .filter((section) => section.depth > 0)
    .map((section) => ({ kind: "heading", depth: section.depth, text: section.heading, offset: section.span.start }));

/** An item's own lines, joined, without its marker: the lines it wraps onto, up to a nested item. */
const itemText = (written: string): string => {
  const [first = "", ...rest] = written.split("\n");
  const nested = rest.findIndex((line) => LIST_MARKER.test(line));
  return [first.replace(LIST_MARKER, ""), ...(nested === -1 ? rest : rest.slice(0, nested))].map((line) => line.trim()).join(" ");
};

const itemsOf = (doc: ProseDocument): RequirementBlock[] =>
  doc.lists.flatMap((list) => list.itemSpans.map((span) => ({ kind: "item", text: itemText(doc.source.slice(span.start, span.end)), offset: span.start })));

const inside = (offset: number, spans: readonly Span[]): boolean => spans.some((span) => offset >= span.start && offset < span.end);

/** The lines outside lists, with code, headings and emphasis marks blanked out: the places a label (必須：) stands alone. */
const linesOf = (doc: ProseDocument): RequirementBlock[] => {
  const prose = doc.prose ?? doc.source;
  const starts = [0, ...[...prose.matchAll(/\n/gu)].map((match) => match.index + 1)];
  return starts.flatMap((start) => {
    const line = prose.slice(start, prose.indexOf("\n", start) === -1 ? prose.length : prose.indexOf("\n", start));
    return line.trim() === "" || inside(start, doc.listSpans) ? [] : [{ kind: "line", text: line, offset: start }];
  });
};

export const requirementLists: Detector = (doc): Finding[] => {
  const blocks = [...headingsOf(doc), ...linesOf(doc), ...itemsOf(doc)].toSorted((left, right) => left.offset - right.offset);
  return requiredListedAsPreferred(blocks, wordsOf(doc)).map((issue) => ({
    rule: "required-listed-as-preferred",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
