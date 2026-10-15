// Vague words dense for the document's length (vague-word-density). Each sentence counts the vague words it holds once:
// a word inside a longer one ("timely" in "in a timely manner") is that longer word, and a word inside a term of art of the
// document's genre ("reasonably" in a contract, "adequately compensate" as the test for an injunction) is not vague
// there. The rule speaks once per sentence, about the document's density. Pure: the words come from the language's
// lexicons vague-word and vague-word-term-of-art, the genre from the options.
import { entriesForGenre } from "../lexicon-genres.ts";
import { escapeRegExp } from "../orthography.ts";
import type { Detector, Finding, Lexicon, LexiconEntry, Sentence } from "../plugin.ts";
import { comparableText, comparableWords, entryRanges } from "./lexicon-match.ts";
import { rateOver } from "./lexicon.ts";

const TERMS_OF_ART = "vague-word-term-of-art";

type Place = { readonly start: number; readonly end: number };

type Match = { readonly pattern: string; readonly place: Place };

/** Token spans are places in the document and text places are in the sentence, so one sentence uses one kind for every entry. */
const readsTokens = (sentence: Sentence, entries: Lexicon): boolean =>
  sentence.tokens !== undefined && entries.every((entry) => (entry.tokens?.length ?? 0) > 0);

/** Where an entry stands in the sentence, as character spans: its tokens, or the comparable text. */
const placesOf = (sentence: Sentence, entry: LexiconEntry, byTokens: boolean): Place[] => {
  const tokens = sentence.tokens;
  if (byTokens && tokens !== undefined)
    return entryRanges(sentence, entry).map((range) => ({ start: tokens[range.start]?.span.start ?? 0, end: tokens[range.end - 1]?.span.end ?? 0 }));
  const word = comparableWords(entry.pattern);
  if (word === "") return [];
  return [...comparableText(sentence).matchAll(new RegExp(escapeRegExp(word), "gu"))].map((found) => ({ start: found.index, end: found.index + word.length }));
};

const matchesOf = (sentence: Sentence, lexicon: Lexicon, byTokens: boolean): Match[] =>
  lexicon.flatMap((entry) => placesOf(sentence, entry, byTokens).map((place) => ({ pattern: entry.pattern, place })));

const covers = (outer: Place, inner: Place): boolean => outer.start <= inner.start && inner.end <= outer.end;

const isLonger = (outer: Match, inner: Match): boolean => outer.place.end - outer.place.start > inner.place.end - inner.place.start;

/** The vague words of one sentence, in the order written, each once: none inside a longer vague word or a term of art. */
export const vagueWordsIn = (sentence: Sentence, vague: Lexicon, termsOfArt: Lexicon): string[] => {
  const byTokens = readsTokens(sentence, [...vague, ...termsOfArt]);
  const matches = matchesOf(sentence, vague, byTokens);
  const terms = matchesOf(sentence, termsOfArt, byTokens);
  const kept = matches.filter(
    (match) => !matches.some((other) => isLonger(other, match) && covers(other.place, match.place)) && !terms.some((term) => covers(term.place, match.place)),
  );
  return [...new Set(kept.toSorted((left, right) => left.place.start - right.place.start).map((match) => match.pattern))];
};

type SentenceHits = { readonly sentence: Sentence; readonly words: readonly string[] };

export const vagueDensity: Detector = (doc, options): Finding[] => {
  const termsOfArt = entriesForGenre(doc.lexicons[TERMS_OF_ART] ?? [], options.genre);
  const hits: SentenceHits[] = doc.sentences
    .map((sentence) => ({ sentence, words: vagueWordsIn(sentence, options.lexicon ?? [], termsOfArt) }))
    .filter((hit) => hit.words.length > 0);
  const count = hits.reduce((sum, hit) => sum + hit.words.length, 0);
  const density = rateOver(doc, count, options.limit);
  if (density === undefined) return [];
  return hits.map(({ sentence, words }) => ({
    rule: "vague-word-density",
    severity: "warning",
    line: 0,
    column: 0,
    quote: sentence.text.trim(),
    values: { matched: words[0] ?? "", count, density, limit: options.limit, offset: sentence.span.start },
  }));
};
