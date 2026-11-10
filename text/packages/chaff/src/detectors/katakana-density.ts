import type { Detector, Finding, ProseDocument, Sentence } from "../plugin.ts";
import { frontMatterValues } from "../front-matter.ts";
import { proseText } from "../measure.ts";
import { rateOver } from "./lexicon.ts";

/** A katakana word, full or half width: two or more katakana, not starting with the long-vowel mark. A middle dot (ジョン・スミス) splits it. */
const KATAKANA_WORD = /[ァ-ヴ][ァ-ヴー]+|[ｦ-ﾝ][ｦ-ﾟ]+/gu;

/** A line break inside a katakana word (アジェ↵ンダ): a wrapped line, not two words. */
const WRAP_IN_WORD = /(?<=[ァ-ヴーｦ-ﾟ])[^\S\n]*\n[^\S\n]*(?=[ァ-ヴーｦ-ﾟ])/gu;

/** How many of the most frequent words the message names. */
const NAMED_WORDS = 3;

type KatakanaWord = { readonly sentence: Sentence; readonly word: string };

/** The text with each of the team's names (chaff.yaml names:) blanked out, longest first: a name is not a loanword to trim. */
const withoutNames = (text: string, names: readonly string[]): string =>
  names
    .filter((name) => name !== "")
    .toSorted((left, right) => right.length - left.length)
    .reduce((rest, name) => rest.replaceAll(name, " "), text);

/** The katakana words of one sentence's text, a line wrapped inside a word joined back, the team's names left out. */
export const katakanaWordsIn = (text: string, names: readonly string[]): string[] =>
  [...withoutNames(text.replace(WRAP_IN_WORD, ""), names).matchAll(KATAKANA_WORD)].map((match) => match[0]);

/** The words used most, most frequent first; ties keep the order they first appear in. */
export const mostFrequent = (words: readonly string[], count: number): string[] => {
  const tally = words.reduce((counts, word) => counts.set(word, (counts.get(word) ?? 0) + 1), new Map<string, number>());
  return [...tally.entries()]
    .toSorted((left, right) => right[1] - left[1])
    .slice(0, count)
    .map(([word]) => word);
};

/** The document's titles: its first top-level heading, and the title its front matter gives (a site generator shows that one instead). */
const titlesOf = (doc: ProseDocument): string[] => [
  doc.markup?.headings.find((heading) => heading.depth === 1)?.text ?? "",
  ...frontMatterValues(doc.source, "title"),
];

/**
 * The katakana words of the document's title: what the document is about (e-Govアカウントの登録方法). A manual on accounts
 * cannot say アカウント another way, so the subject is not a loanword to trim.
 */
export const subjectWords = (doc: ProseDocument): ReadonlySet<string> => new Set(titlesOf(doc).flatMap((title) => katakanaWordsIn(title, doc.names ?? [])));

const wordsOfDocument = (doc: ProseDocument): KatakanaWord[] => {
  const subject = subjectWords(doc);
  return doc.sentences.flatMap((sentence) =>
    katakanaWordsIn(sentence.text, doc.names ?? [])
      .filter((word) => !subject.has(word))
      .map((word) => ({ sentence, word })),
  );
};

/**
 * Katakana loanwords per 1000 characters, over the whole document. Reported once, at the first sentence holding one, with the
 * words used most: those are the ones a Japanese word could replace first. Short documents are not measured.
 */
export const katakanaDensity: Detector = (doc, options): Finding[] => {
  const found = wordsOfDocument(doc);
  const density = rateOver(doc, found.length, options.limit);
  const first = found[0];
  if (density === undefined || first === undefined) return [];
  const words = mostFrequent(
    found.map((hit) => hit.word),
    NAMED_WORDS,
  );
  return [
    {
      rule: "katakana-density",
      severity: "info",
      line: 0,
      column: 0,
      quote: proseText(first.sentence),
      values: { count: found.length, density, limit: options.limit, words: words.join("、"), offset: first.sentence.span.start },
    },
  ];
};
