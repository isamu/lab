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

const touches = (left: Token | undefined, right: Token | undefined): boolean => left !== undefined && right !== undefined && left.span.end === right.span.start;

/**
 * The first token of the compound noun the verbal noun ends: 塗り + 直し is 塗り直し, and 直しする is not a verb to write.
 * Nouns written straight before it, with no space, are one word.
 */
const compoundStart = (tokens: readonly Token[], at: number): number =>
  tokens[at - 1]?.pos === "NOUN" && touches(tokens[at - 1], tokens[at]) ? compoundStart(tokens, at - 1) : at;

/**
 * The verbal noun is an event noun, or ends a compound that is one as written (計画運休, whose する form is not written, even
 * where the tagger leaves 計画 out of the compound).
 */
const isEventNoun = (source: string, noun: Token, eventNouns: ReadonlySet<string>): boolean =>
  eventNouns.has(noun.surface) || [...eventNouns].some((word) => word.length > noun.surface.length && source.startsWith(word, noun.span.end - word.length));

/**
 * A carrying verb right after a verbal noun: 調査 + を実施した, the noun read with the compound it ends (塗り直し). Both sides are named in the dictionary form, the noun and the
 * entry (調査を実施する), and the verb to write is the noun and the entry's instead_of (調査 + する).
 */
const lightVerbsIn = (sentence: Sentence, source: string, lightVerbs: Lexicon, eventNouns: ReadonlySet<string>): Hidden[] => {
  const tokens = sentence.tokens ?? [];
  return lightVerbs.flatMap((entry) =>
    entryRanges(sentence, entry).flatMap((range): Hidden[] => {
      const noun = tokens[range.start - 1];
      if (!isVerbalNoun(noun) || isEventNoun(source, noun, eventNouns)) return [];
      const compound = source.slice(tokens[compoundStart(tokens, range.start - 1)]?.span.start ?? noun.span.start, noun.span.end);
      return [{ sentence, offset: noun.span.start, matched: `${compound}${entry.pattern}`, preferred: `${compound}${entry.instead_of ?? ""}` }];
    }),
  );
};

/** Pure: every hidden verb in the document, in the order they are written. */
export const hiddenVerbs = (doc: Pick<ProseDocument, "sentences" | "source" | "lexicons">): Hidden[] => {
  const eventNouns = new Set((doc.lexicons[EVENT_NOUNS] ?? []).map((entry) => entry.pattern));
  return doc.sentences
    .flatMap((sentence) => [
      ...phrasesIn(sentence, doc.source, doc.lexicons[PHRASES] ?? []),
      ...lightVerbsIn(sentence, doc.source, doc.lexicons[LIGHT_VERBS] ?? [], eventNouns),
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
