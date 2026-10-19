import type { Detector, LexiconEntry, ProseDocument, Sentence } from "../plugin.ts";
import { entryRanges } from "./lexicon-match.ts";
import { phraseMatchWhere } from "./phrase-match.ts";
import { followsToldQuote, type TellingCues } from "./reported-speech.ts";

const cuesOf = (doc: ProseDocument): TellingCues => {
  const entries = doc.lexicons["telling-cue"] ?? [];
  const inGroup = (group: string): string[] => entries.filter((entry) => entry.group === group).map((entry) => entry.pattern);
  return { occasion: inGroup("occasion"), sayer: inGroup("sayer") };
};

/**
 * A weasel phrase counts unless every use of it in the sentence reports a quotation told on a named occasion or by a named
 * sayer (申し込んだら、「…」と言われています). Without tokens the uses cannot be placed, so each one counts.
 */
const isWeaselUse = (doc: ProseDocument, sentence: Sentence, entry: LexiconEntry): boolean => {
  const tokens = sentence.tokens ?? [];
  const ranges = entryRanges(sentence, entry);
  if (ranges.length === 0) return true;
  const cues = cuesOf(doc);
  return !ranges.every((range) => followsToldQuote(doc.source.slice(sentence.span.start, tokens[range.start]?.span.start ?? sentence.span.start), cues));
};

export const weaselWord: Detector = (doc, options) => phraseMatchWhere(doc, options, (sentence, entry) => isWeaselUse(doc, sentence, entry));
