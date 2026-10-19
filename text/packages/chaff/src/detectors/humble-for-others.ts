import type { Detector, Finding, Lexicon, LexiconEntry, Sentence, Span } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { isWithinAny } from "../quoted-span.ts";
import { entryIn, entryRanges } from "./lexicon-match.ts";

/** The phrases where a listed form is the writer's own act (何とも申されません: 申す in the potential), not an honorific for another. */
const OWN_ACT_LEXICON = "humble-own-act";

/**
 * Where the sentence holds one of the phrases as written, in the document's coordinates. Own-act phrases are matched this
 * way, not by words: the parser splits 何とも differently alone and in a sentence.
 */
const writtenSpans = (sentence: Sentence, phrases: Lexicon): Span[] =>
  phrases.flatMap((entry) =>
    [...sentence.text.matchAll(new RegExp(escapeRegExp(entry.pattern), "gu"))].map((match) => ({
      start: sentence.span.start + match.index,
      end: sentence.span.start + match.index + entry.pattern.length,
    })),
  );

/** Where the entry's words stand in the sentence. Without tokens the place is unknown. */
const entrySpans = (sentence: Sentence, entry: LexiconEntry): Span[] => {
  const tokens = sentence.tokens ?? [];
  return entryRanges(sentence, entry).flatMap((range) => {
    const first = tokens[range.start];
    const last = tokens[range.end - 1];
    return first === undefined || last === undefined ? [] : [{ start: first.span.start, end: last.span.end }];
  });
};

/** Without tokens the entry is matched as phrase-match does; a match whose every written place is in an own-act phrase is left out. */
const usedForOthersUntagged = (sentence: Sentence, entry: LexiconEntry, ownActs: readonly Span[]): boolean => {
  const written = writtenSpans(sentence, [entry]);
  return entryIn(sentence, entry) && !(written.length > 0 && written.every((span) => isWithinAny(ownActs, span)));
};

/** A use of the entry outside every own-act phrase. */
const usedForOthers = (sentence: Sentence, entry: LexiconEntry, ownActs: readonly Span[]): boolean =>
  sentence.tokens === undefined
    ? usedForOthersUntagged(sentence, entry, ownActs)
    : entrySpans(sentence, entry).some((span) => !isWithinAny(ownActs, span));

/** The first listed form the sentence uses for someone else's act, or undefined. */
const humbleFormFor = (sentence: Sentence, forms: Lexicon, ownActPhrases: Lexicon): string | undefined => {
  const ownActs = writtenSpans(sentence, ownActPhrases);
  return forms.find((entry) => usedForOthers(sentence, entry, ownActs))?.pattern;
};

/** phrase-match for humble verbs, leaving out the phrases where the form is the writer's own act. */
export const humbleForOthers: Detector = (doc, options): Finding[] => {
  const ownActPhrases = doc.lexicons[OWN_ACT_LEXICON] ?? [];
  const hits = doc.sentences.flatMap((sentence) => {
    const matched = humbleFormFor(sentence, options.lexicon ?? [], ownActPhrases);
    return matched === undefined ? [] : [{ sentence, matched }];
  });
  if (hits.length < options.limit) return [];
  return hits.map((hit) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.matched, count: hits.length, limit: options.limit, offset: hit.sentence.span.start },
  }));
};
