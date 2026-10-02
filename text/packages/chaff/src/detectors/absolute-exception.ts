import type { Detector, Finding, Lexicon, ProseDocument, Sentence, Span, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { contentKey, type Obligation } from "../structure/modal-conflict.ts";
import { actOf, contradictedAbsolutes, type Statement } from "../structure/absolute-exception.ts";
import { linesOf, lineNumberAt } from "../structure/lines.ts";
import { isWithinAny, QUOTATION_MARKS, quotedIn } from "../quoted-span.ts";
import { entryRanges } from "./lexicon-match.ts";
import { obligationsOf } from "./modal-conflict.ts";
import { quoteAt } from "./structure-tree.ts";

const REQUIRING: ReadonlySet<string> = new Set(["must", "must-not"]);

type Hit = { readonly word: string; readonly span: Span };

/** Where the lexicon's words stand in the sentence, outside quotations, in reading order. Needs the sentence's tokens. */
const hitsIn = (sentence: Sentence, lexicon: Lexicon, quoted: readonly Span[]): Hit[] => {
  const tokens = sentence.tokens ?? [];
  return lexicon
    .flatMap((entry) =>
      entryRanges(sentence, entry).flatMap((range) => {
        const first = tokens[range.start];
        const last = tokens[range.end - 1];
        if (first === undefined || last === undefined) return [];
        const span = { start: first.span.start, end: last.span.end };
        return isWithinAny(quoted, span) ? [] : [{ word: entry.pattern, span }];
      }),
    )
    .toSorted((left, right) => left.span.start - right.span.start);
};

const within = (span: Span, offset: number): boolean => offset >= span.start && offset < span.end;

/** The units an exception may sit in and still be the statement's own proviso: articles, then lists, then paragraphs. */
type Units = { readonly articles: readonly Span[]; readonly lists: readonly Span[]; readonly paragraphs: readonly Span[] };

const unitsOf = (doc: ProseDocument, tree: StructureNode): Units => ({
  articles: inDocumentOrder(tree).flatMap((node) => (node.kind === "article" ? [node.span] : [])),
  lists: doc.lists.map((list) => list.span),
  paragraphs: doc.paragraphs.map((paragraph) => paragraph.span),
});

/** The innermost span holding the offset: an article nested in another is a unit of its own. */
const innermost = (spans: readonly Span[], offset: number): Span | undefined =>
  spans
    .filter((span) => within(span, offset))
    .reduce<Span | undefined>((inner, span) => (inner === undefined || span.start > inner.start ? span : inner), undefined);

const unitAt = (units: Units, offset: number): number =>
  [units.articles, units.lists, units.paragraphs].map((spans) => innermost(spans, offset)).find((span) => span !== undefined)?.start ?? offset;

type Words = { readonly absolute: Lexicon; readonly exception: Lexicon; readonly lightVerbs: ReadonlySet<string> };

/** The sentence read for the rule, or nothing when it holds neither word. Only such sentences pay for the unit and the markers. */
const statementOf = (sentence: Sentence, obligations: readonly Obligation[], words: Words, units: Units): Statement | undefined => {
  const quoted = quotedIn(sentence, QUOTATION_MARKS);
  const absolute = hitsIn(sentence, words.absolute, quoted);
  const exception = hitsIn(sentence, words.exception, quoted);
  const tokens = sentence.tokens;
  if ((absolute.length === 0 && exception.length === 0) || tokens === undefined) return undefined;
  const markers = obligations.filter((obligation) => within(sentence.span, obligation.start));
  const read = [...absolute, ...exception].map((hit) => hit.span);
  const key = contentKey(tokens, [...markers, ...read]);
  const [marker] = markers;
  return {
    offset: sentence.span.start,
    words: key === "" ? [] : key.split(" "),
    absolute: absolute[0]?.word,
    exception: exception[0]?.word,
    obligation: markers.length === 1 && REQUIRING.has(marker?.type ?? ""),
    act: marker === undefined ? undefined : actOf(tokens, marker, read, words.lightVerbs),
    unit: unitAt(units, sentence.span.start),
  };
};

/** An absolute obligation (すべての〜は…しなければならない, "must always") that a later sentence elsewhere makes an exception to. */
export const absoluteException: Detector = (doc, options): Finding[] => {
  if (doc.structure === undefined) return [];
  const words = {
    absolute: options.lexicon ?? [],
    exception: doc.lexicons["exception-marker"] ?? [],
    lightVerbs: new Set((doc.lexicons["light-verb"] ?? []).map((entry) => entry.pattern.toLowerCase())),
  };
  const obligations = obligationsOf(doc.structure);
  const units = unitsOf(doc, doc.structure);
  const statements = doc.sentences
    .filter((sentence) => sentence.embeddedLanguage === undefined)
    .flatMap((sentence) => statementOf(sentence, obligations, words, units) ?? []);
  const lines = linesOf(doc.source);
  return contradictedAbsolutes(statements).map(({ absolute, exception }) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, absolute.offset),
    values: {
      word: absolute.absolute ?? "",
      exception: exception.exception ?? "",
      otherLine: lineNumberAt(lines, exception.offset) ?? 0,
      offset: absolute.offset,
    },
  }));
};
