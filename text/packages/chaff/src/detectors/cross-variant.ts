import type { CrossDetector, DocumentFinding, ProseDocument } from "../plugin.ts";
import { oddSpellings, type DocumentWords, type KeyedWord, type OddSpelling } from "../cross-variants.ts";
import { stemMorae, stemOf } from "../long-vowel.ts";
import { DEFAULT_MIN_MORAE, distinctWordsOf, exemptStems, kanaWordsOf } from "./long-vowel.ts";
import { spelledWordsIn, spellingsOf } from "./spelling-variety.ts";
import { isWithinAny, quotedIn } from "../quoted-span.ts";

// The words read for cross-doc-term-variant, each with the key both its spellings share. Three ways of spelling one word
// that chaff already reads in one document: the final ー of a katakana word (katakana-long-vowel), British and American
// spellings (spelling-consistency's word lists), and a Latin word written with and without a hyphen (e-mail, email).

/**
 * Katakana nouns as the language package split them, keyed by the word without its final ー. Short words keep their ー.
 * A word in 「」 is named, not used (「サーバ」ではなく「サーバー」と書く), and does not count.
 */
const kanaWords = (doc: ProseDocument): KeyedWord[] => {
  const exempt = exemptStems(distinctWordsOf(doc));
  return doc.sentences.flatMap((sentence) => {
    const quoted = quotedIn(sentence);
    return kanaWordsOf(sentence, doc.names ?? [], exempt)
      .filter((word) => stemMorae(word.surface) >= DEFAULT_MIN_MORAE)
      .filter((word) => !isWithinAny(quoted, { start: word.offset, end: word.offset + word.surface.length }))
      .map((word) => ({ key: `kana:${stemOf(word.surface)}`, form: word.surface, offset: word.offset }));
  });
};

/** Words of the language's spelling lists (colour / color), keyed by the pair. */
const listedWords = (doc: ProseDocument): KeyedWord[] => {
  const spellings = spellingsOf(doc.lexicons);
  return doc.sentences.flatMap((sentence) =>
    spelledWordsIn(sentence, spellings).map((word) => {
      const pair = [word.written.toLowerCase(), word.spelling.other.toLowerCase()].toSorted((left, right) => left.localeCompare(right, "en")).join("/");
      return { key: `listed:${pair}`, form: word.written.toLowerCase(), offset: word.offset };
    }),
  );
};

const LATIN_WORD = /(?<![\p{L}\p{N}_-])\p{Script=Latin}+(?:-\p{Script=Latin}+)*(?![\p{L}\p{N}_-])/gu;
const HYPHEN = "-";

/** A Latin word's key: lower case, hyphens out. e-mail and Email share it with email. */
const latinKey = (word: string): string => `latin:${word.toLowerCase().replaceAll(HYPHEN, "")}`;

const latinWordsOf = (doc: ProseDocument): KeyedWord[] =>
  doc.sentences.flatMap((sentence) =>
    [...sentence.text.matchAll(LATIN_WORD)].map((match) => ({
      key: latinKey(match[0]),
      form: match[0].toLowerCase(),
      offset: sentence.span.start + match.index,
    })),
  );

/** The Latin words of every document whose key some document of the run writes with a hyphen. Other words are not variants. */
const hyphenWords = (docs: readonly ProseDocument[]): readonly KeyedWord[][] => {
  const words = docs.map(latinWordsOf);
  const hyphenated = new Set(words.flat().flatMap((word) => (word.form.includes(HYPHEN) ? [word.key] : [])));
  return words.map((ofDoc) => ofDoc.filter((word) => hyphenated.has(word.key)));
};

const quoteAt = (doc: ProseDocument, offset: number): string =>
  doc.sentences.find((sentence) => sentence.span.start <= offset && offset < sentence.span.end)?.text.trim() ?? "";

const findingOf = (byPath: ReadonlyMap<string, ProseDocument>, odd: OddSpelling): DocumentFinding[] => {
  const doc = byPath.get(odd.path);
  if (doc === undefined) return [];
  const matched = doc.source.slice(odd.word.offset, odd.word.offset + odd.word.form.length);
  const values = { matched, preferred: odd.usual, count: odd.files, other: odd.example, offset: odd.word.offset };
  return [{ path: odd.path, finding: { rule: "", severity: "warning", line: 0, column: 0, quote: quoteAt(doc, odd.word.offset), values } }];
};

/** A word spelled one way in some files of the run and another way in the rest: reported in the files of the fewer way. */
export const crossDocTermVariant: CrossDetector = (docs) => {
  const latin = hyphenWords(docs);
  const words: DocumentWords[] = docs.map((doc, index) => ({ path: doc.path, words: [...kanaWords(doc), ...listedWords(doc), ...(latin[index] ?? [])] }));
  const byPath = new Map(docs.map((doc) => [doc.path, doc]));
  return oddSpellings(words).flatMap((odd) => findingOf(byPath, odd));
};
