import type { Detector, DetectorOptions, Finding, ProseDocument, Sentence } from "../../plugin.ts";
import { densityFindings } from "../ai-phrasing.ts";
import { colonLeadIns } from "../list-lead-in.ts";

/** Lead-ins in one or two sections are a how-to's procedure or a pair of lists; the rule's why is section after section. */
const DEFAULT_MIN_SECTIONS = 3;

const minSections = (options: DetectorOptions): number => {
  const value = options.settings?.["min_sections"];
  return typeof value === "number" ? value : DEFAULT_MIN_SECTIONS;
};

/** How many sections hold a lead-in. A document without headings cannot be split, so each lead-in counts as its own. */
const sectionsHolding = (doc: ProseDocument, leadIns: readonly Sentence[]): number => {
  if (!doc.sections.some((section) => section.depth > 0)) return leadIns.length;
  const sectionOf = (sentence: Sentence): number => doc.sections.findLastIndex((section) => section.span.start <= sentence.span.start);
  return new Set(leadIns.map(sectionOf)).size;
};

/**
 * コロンで箇条書きへ渡す文（以下の通りです：）。1 つなら案内だが、節ごとに続くと説明が箇条書きの前置きだけになる。
 * 数えるのは文書の言語の文だけ。和文の中の英文（Examples include:）は、英語ではふつうの書き方なので数えない。
 */
export const detector: Detector = (doc, options): Finding[] => {
  const inDocumentLanguage = doc.sentences.filter((sentence) => sentence.embeddedLanguage === undefined);
  const leadIns = colonLeadIns(inDocumentLanguage, doc.lists, doc.listSpans, doc.source);
  if (sectionsHolding(doc, leadIns) < minSections(options)) return [];
  const hits = leadIns.map((sentence) => ({ sentence, matched: sentence.text.trim() }));
  return densityFindings(doc, hits, options.limit);
};
