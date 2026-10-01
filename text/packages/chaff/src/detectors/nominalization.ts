import type { Detector, Finding, Lexicon, ProseDocument, Sentence, Token } from "../plugin.ts";
import { entryRanges, type TokenRange } from "./lexicon-match.ts";
import { rateOver } from "./lexicon.ts";

// A verb written as a noun and carried by another verb: 調査を実施した for 調査した, "make a decision" for "decide"
// (the やさしい日本語 guideline; the Federal Plain Language Guidelines' hidden verbs; GOV.UK). Two shapes, each from a
// lexicon the language may or may not have: a whole phrase with its verb (nominalization-phrase), or a verbal noun
// (the adapter's VerbForm=Vnoun) followed by a carrying verb (nominalization-light-verb). Counted as a density.

export type Hidden = { readonly sentence: Sentence; readonly offset: number; readonly matched: string; readonly preferred: string };

const PHRASES = "nominalization-phrase";
const LIGHT_VERBS = "nominalization-light-verb";
/** Verbal nouns whose carrying verb means "hold" (研修を実施する is not 研修する): not hidden verbs. */
const EVENT_NOUNS = "nominalization-event-noun";

const isVerbalNoun = (token: Token | undefined): token is Token => token?.features?.["VerbForm"] === "Vnoun";

const writtenBetween = (source: string, tokens: readonly Token[], range: TokenRange): string => {
  const [first, last] = [tokens[range.start], tokens[range.end - 1]];
  return first === undefined || last === undefined ? "" : source.slice(first.span.start, last.span.end);
};

/** A phrase of the lexicon, with the verb it hides (instead_of). */
const phrasesIn = (sentence: Sentence, source: string, phrases: Lexicon): Hidden[] =>
  phrases.flatMap((entry) =>
    entryRanges(sentence, entry).map((range) => ({
      sentence,
      offset: sentence.tokens?.[range.start]?.span.start ?? sentence.span.start,
      matched: writtenBetween(source, sentence.tokens ?? [], range),
      preferred: entry.instead_of ?? "",
    })),
  );

/**
 * A carrying verb right after a verbal noun: 調査 + を実施した. Both sides are named in the dictionary form, the noun and the
 * entry (調査を実施する), and the verb to write is the noun and the entry's instead_of (調査 + する).
 */
const lightVerbsIn = (sentence: Sentence, lightVerbs: Lexicon, eventNouns: ReadonlySet<string>): Hidden[] => {
  const tokens = sentence.tokens ?? [];
  return lightVerbs.flatMap((entry) =>
    entryRanges(sentence, entry).flatMap((range): Hidden[] => {
      const noun = tokens[range.start - 1];
      if (!isVerbalNoun(noun) || eventNouns.has(noun.surface)) return [];
      return [{ sentence, offset: noun.span.start, matched: `${noun.surface}${entry.pattern}`, preferred: `${noun.surface}${entry.instead_of ?? ""}` }];
    }),
  );
};

/** Pure: every hidden verb in the document, in the order they are written. */
export const hiddenVerbs = (doc: Pick<ProseDocument, "sentences" | "source" | "lexicons">): Hidden[] => {
  const eventNouns = new Set((doc.lexicons[EVENT_NOUNS] ?? []).map((entry) => entry.pattern));
  return doc.sentences
    .flatMap((sentence) => [
      ...phrasesIn(sentence, doc.source, doc.lexicons[PHRASES] ?? []),
      ...lightVerbsIn(sentence, doc.lexicons[LIGHT_VERBS] ?? [], eventNouns),
    ])
    .toSorted((left, right) => left.offset - right.offset);
};

export const nominalization: Detector = (doc, options): Finding[] => {
  const hidden = hiddenVerbs(doc);
  const rate = rateOver(doc, hidden.length, options.limit);
  if (rate === undefined) return [];
  return hidden.map((found) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: found.sentence.text.trim(),
    values: { matched: found.matched, preferred: found.preferred, count: hidden.length, density: rate, limit: options.limit, offset: found.offset },
  }));
};
