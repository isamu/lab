import type { Detector, LexiconEntry, ProseDocument, Sentence, Span } from "../plugin.ts";
import { entryRanges } from "./lexicon-match.ts";
import { phraseMatchWhere } from "./phrase-match.ts";
import { followsToldQuote, type TellingCues } from "./reported-speech.ts";
import { citationMarks, citationWordsOf, referenceListsOf } from "./citation-marks.ts";

const cuesOf = (doc: ProseDocument): TellingCues => {
  const entries = doc.lexicons["telling-cue"] ?? [];
  const inGroup = (group: string): string[] => entries.filter((entry) => entry.group === group).map((entry) => entry.pattern);
  return { occasion: inGroup("occasion"), sayer: inGroup("sayer") };
};

/** The clause a phrase closes: the text after the last comma before it (…、魚釣りと洗練から作られた造語である). */
const lastClause = (before: string): string => before.slice(Math.max(before.lastIndexOf("、"), before.lastIndexOf("，"), before.lastIndexOf(",")) + 1);

/** The phrase hedges where a word or a name comes from (…から作られた造語であるといわれています): an origin has no one source to name. */
const hedgesOrigin = (before: string, origins: readonly string[]): boolean => {
  const clause = lastClause(before);
  return origins.some((origin) => clause.includes(origin));
};

/** Where the document names its sources: its reference lists, and the in-text citations ([11, 49], Smith (2020)). */
type Sources = { readonly referenceLists: readonly Span[]; readonly citations: readonly Span[] };

const sourcesOf = (doc: ProseDocument): Sources => {
  const words = citationWordsOf(doc);
  const referenceLists = referenceListsOf(doc, words);
  return { referenceLists, citations: citationMarks(doc.prose ?? doc.source, referenceLists, words) };
};

const isInside = (spans: readonly Span[], at: number): boolean => spans.some((span) => span.start <= at && at < span.end);

/**
 * A phrase that names its source: an entry of a reference list (a cited headline, "…, experts say") is the cited work's
 * words, and a citation later in the sentence ("previous studies showing … [11, 49]") says which studies.
 */
const namesSource = (sources: Sources, sentence: Sentence, phraseStart: number): boolean =>
  isInside(sources.referenceLists, sentence.span.start) ||
  sources.citations.some((citation) => phraseStart <= citation.start && citation.start < sentence.span.end);

/**
 * A weasel phrase counts unless every use of it in the sentence reports a quotation told on a named occasion or by a named
 * sayer (申し込んだら、「…」と言われています), hedges where a word comes from, or names its source. Without tokens the uses cannot be placed, so each one counts.
 */
const isWeaselUse = (doc: ProseDocument, sources: Sources, sentence: Sentence, entry: LexiconEntry): boolean => {
  const tokens = sentence.tokens ?? [];
  const ranges = entryRanges(sentence, entry);
  if (ranges.length === 0) return true;
  const cues = cuesOf(doc);
  const origins = (doc.lexicons["origin-hedge"] ?? []).map((entry) => entry.pattern);
  return !ranges.every((range) => {
    const start = tokens[range.start]?.span.start ?? sentence.span.start;
    const before = doc.source.slice(sentence.span.start, start);
    return followsToldQuote(before, cues) || hedgesOrigin(before, origins) || namesSource(sources, sentence, start);
  });
};

export const weaselWord: Detector = (doc, options) => {
  const sources = sourcesOf(doc);
  return phraseMatchWhere(doc, options, (sentence, entry) => isWeaselUse(doc, sources, sentence, entry));
};
