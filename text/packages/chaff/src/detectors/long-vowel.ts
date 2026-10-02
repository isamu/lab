import type { Detector, Finding, OptionValue, ProseDocument, Sentence } from "../plugin.ts";
import { isKatakanaWord, oddLongVowels, stemOf, type Ending, type KanaWord } from "../long-vowel.ts";
import { nameSpans, touchesAny } from "../team-names.ts";

const ENDINGS: readonly Ending[] = ["consistent", "drop", "keep"];

const endingOf = (value: OptionValue | undefined): Ending => ENDINGS.find((ending) => ending === value) ?? "consistent";

const wordsOf = (value: OptionValue | undefined): readonly string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

/** The minimum when no setting gives one: two morae before the final ー, which leaves カー alone. */
const DEFAULT_MIN_MORAE = 2;

/** A listed word is exempt written either way: listing コンピューター exempts コンピュータ too. */
const exemptStems = (except: readonly string[]): ReadonlySet<string> => new Set(except.map((word) => stemOf(word.trim())));

/**
 * Words that become another word with a final ー (フリ, as in 振り, and フリー, free): the language's long-vowel-distinct word list.
 * Both are nouns to the tagger, so only the list tells them apart; they are left out as if listed under except.
 * The list is optional: without it the rule still runs and compares every word.
 */
const distinctWordsOf = (doc: ProseDocument): string[] => (doc.lexicons["long-vowel-distinct"] ?? []).map((entry) => entry.pattern);

/**
 * The kana a final ー follows where drop drops it: the language's long-vowel-drop-after list (ア段, the -er, -or, -ar of
 * JIS Z 8301:2011 G.6.2.2). Without the list, drop reaches every final ー.
 */
const dropAfterOf = (doc: ProseDocument): ReadonlySet<string> | undefined => {
  const kana = doc.lexicons["long-vowel-drop-after"];
  return kana === undefined ? undefined : new Set(kana.map((entry) => entry.pattern));
};

/**
 * The katakana nouns of a sentence, as the language adapter split them: ユーザー inside ユーザーインターフェース is its own word.
 * Proper nouns (PROPN) and the team's names keep their own spelling (ディズニー).
 */
const kanaWordsOf = (sentence: Sentence, names: readonly string[], exempt: ReadonlySet<string>): KanaWord[] => {
  const named = nameSpans(sentence.text, names);
  return (sentence.tokens ?? [])
    .filter((token) => token.pos === "NOUN" && isKatakanaWord(token.surface) && !exempt.has(stemOf(token.surface)))
    .filter((token) => !touchesAny(named, token.span.start - sentence.span.start, token.span.end - sentence.span.start))
    .map((token) => ({
      surface: token.surface,
      offset: token.span.start,
      long: token.surface.endsWith("ー"),
      dropped: token.features?.["LongVowelEnding"] === "Dropped",
    }));
};

const quoteAt = (doc: ProseDocument, offset: number): string =>
  doc.sentences.find((sentence) => sentence.span.start <= offset && offset < sentence.span.end)?.text.trim() ?? "";

/**
 * The final ー of katakana loanwords (コンピューター / コンピュータ). With no setting, it takes no side: it points at a word written
 * both ways, and at the way the document writes less. Set to drop or keep, it points at every word the other way.
 */
export const katakanaLongVowel: Detector = (doc, options): Finding[] => {
  const settings = options.settings ?? {};
  const minMorae = typeof settings["min_morae"] === "number" ? settings["min_morae"] : DEFAULT_MIN_MORAE;
  const exempt = exemptStems([...wordsOf(settings["except"]), ...distinctWordsOf(doc)]);
  const words = doc.sentences.flatMap((sentence) => kanaWordsOf(sentence, doc.names ?? [], exempt));
  const odd = oddLongVowels(words, endingOf(settings["ending"]), minMorae, dropAfterOf(doc));
  if (odd.length === 0 || odd.length < options.limit) return [];
  return odd.map((entry) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc, entry.word.offset),
    variant: entry.variant,
    values: {
      matched: entry.word.surface,
      preferred: entry.preferred,
      count: entry.count,
      of: entry.of,
      min_morae: minMorae,
      limit: options.limit,
      offset: entry.word.offset,
    },
  }));
};
