import { lengthOf, proseText } from "../measure.ts";
import type { Detector, DetectorOptions, Finding, LengthUnit, Sentence } from "../plugin.ts";
import { citationLead } from "./citation-sentence.ts";
import { isCitationString, wordsAroundCitation } from "./citation-string.ts";
import { isNameList } from "./name-list-sentence.ts";
import { pageMarkerPattern, pageMarkerSize } from "./page-marker.ts";
import { quotedSentenceParts } from "./quoted-sentences.ts";
import { isReproduced, reproducedSpans } from "./reproduced-text.ts";
import { colonQuotationParts, flattenedTableParts, isGrammarBlock, labelLineParts } from "./sentence-parts.ts";
import { isInListItem, isReferenceLine, isTitleLine, quotedTitleWords, remarkAfterTitle, termSeriesSaving } from "./sentence-title.ts";

type Measure = { readonly size: number; readonly limit: number; readonly variant?: string };

/** The page markers' pattern, the citation signals ("see") and the spans of the list items, read once per document. */
type SentenceWords = {
  readonly markers: RegExp | undefined;
  readonly citationSignals: readonly string[];
  readonly listItems: readonly { readonly start: number; readonly end: number }[];
};

/**
 * Words of a title and of a listed run of quoted terms, which the writer did not build into a sentence: a line with no
 * full stop that is a title is not measured, a quoted title in a list item (- CA 23-1 “Changes to …” (January 31, 2023))
 * is not counted, and quoted terms listed one after another ("MUST", "MUST NOT", … and "OPTIONAL") count as one word.
 * Only where words are the unit: the shapes are read from capitals and spaces.
 */
const unwrittenWords = (sentence: Sentence, text: string, listItems: SentenceWords["listItems"]): number =>
  termSeriesSaving(text) + (isInListItem(sentence.span, listItems) || isReferenceLine(text) ? quotedTitleWords(text) : 0);

const sizeOf = (text: string, unit: LengthUnit): number =>
  unit === "word" ? text.split(/\s+/u).filter((word) => word.length > 0).length : text.replace(/\s+/gu, "").length;

/** 「」の中に句点で閉じた文が二つ以上あれば、その一つ一つと括弧の外を別に測る（引いた事故の報告「…転落。…入院。」）。 */
const longestQuotedPart = (text: string, size: number, markers: RegExp | undefined): number => {
  const parts = quotedSentenceParts(text);
  return parts.length === 1 ? size : Math.max(...parts.map((part) => sizeOf(part, "char") - pageMarkerSize(part, markers, "char")));
};

/**
 * 文書と違う言語の文（和文の中の英文）は、その言語の単位と上限で測る。rule がその言語の段を持たなければ文書のもので。
 * 印刷版のページの印（( printed page 52044)）は文の言葉ではないので数えない。
 * 脚注の文献の記載（著者 (2025), "題," …）も書き手の文ではないので、その前に書き手が置いた言葉（For example, see …）だけを測る。
 */
const measureOf = (sentence: Sentence, unit: LengthUnit, options: DetectorOptions, words: SentenceWords): Measure => {
  const lead = citationLead(proseText(sentence), words.citationSignals);
  if (lead !== undefined) return { size: sizeOf(lead, unit), limit: options.limit };
  const embedded = sentence.embeddedLanguage;
  const limit = embedded === undefined ? undefined : options.embeddedLimits?.[embedded.id];
  if (embedded === undefined || limit === undefined) return { size: ownSize(sentence, unit, words), limit: options.limit };
  return { size: lengthOf(sentence, embedded.lengthUnit), limit, variant: `embedded-${embedded.id}` };
};

/** Code or a citation string: nothing in it is the writer's sentence. A title line too, where words are the unit. */
const isUnwritten = (sentence: Sentence, text: string, unit: LengthUnit, words: SentenceWords): boolean =>
  isGrammarBlock(sentence.text) || isCitationString(text, words.citationSignals) || (unit === "word" && isTitleLine(text));

/** The parts measured one by one when the splitter ran several things into one sentence (label lines, table cells, a quotation). */
const partsOf = (sentence: Sentence, text: string): readonly string[] | undefined =>
  labelLineParts(sentence.text) ?? flattenedTableParts(text) ?? colonQuotationParts(text);

/** The length of a sentence in the document's language, without what the writer did not write as one. */
const ownSize = (sentence: Sentence, unit: LengthUnit, words: SentenceWords): number => {
  const text = proseText(sentence);
  if (isUnwritten(sentence, text, unit, words)) return 0;
  const aroundCitation = unit === "word" ? wordsAroundCitation(text, words.citationSignals) : undefined;
  if (aroundCitation !== undefined) return sizeOf(aroundCitation, unit);
  const parts = partsOf(sentence, text);
  if (parts !== undefined) return Math.max(0, ...parts.map((part) => sizeOf(part, unit) - pageMarkerSize(part, words.markers, unit)));
  const remark = unit === "word" ? remarkAfterTitle(text) : undefined;
  if (remark !== undefined) return sizeOf(remark, unit);
  const unwritten = unit === "word" ? unwrittenWords(sentence, text, words.listItems) : 0;
  const size = lengthOf(sentence, unit) - pageMarkerSize(text, words.markers, unit) - unwritten;
  return unit === "char" ? longestQuotedPart(text, size, words.markers) : size;
};

export const sentenceLength: Detector = (doc, options): Finding[] => {
  const words: SentenceWords = {
    markers: pageMarkerPattern((options.lexicon ?? []).map((entry) => entry.pattern)),
    citationSignals: (doc.lexicons["citation-signal"] ?? []).map((entry) => entry.pattern),
    listItems: doc.lists.flatMap((list) => list.itemSpans),
  };
  const long = doc.sentences
    .map((sentence) => ({ sentence, measure: measureOf(sentence, doc.lengthUnit, options, words) }))
    .filter(({ sentence, measure }) => measure.size > measure.limit && !isNameList(proseText(sentence)));
  // 他の文書から引き写した文（法律の条、「reads as follows:」の後の段落）は書き手の文ではない。探すのに文書の木を組むので、長い文があるときだけ。
  const reproduced =
    long.length === 0
      ? []
      : reproducedSpans(
          doc.structure,
          doc.paragraphs,
          doc.source,
          (doc.lexicons["verbatim-lead"] ?? []).map((entry) => entry.pattern),
        );
  return long
    .filter(({ sentence }) => !isReproduced(sentence.span, reproduced))
    .map(({ sentence, measure }) => ({
      rule: "max-sentence-length",
      severity: "warning",
      line: 0,
      column: 0,
      quote: proseText(sentence),
      values: { count: measure.size, limit: measure.limit, offset: sentence.span.start },
      ...(measure.variant === undefined ? {} : { variant: measure.variant }),
    }));
};
