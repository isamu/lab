// An acronym the document explains without the "Name (ACR)" form. Pure.
import { numberedSeries } from "./acronym-series.ts";

/**
 * "The VIX—a forward-looking measure of near-term stock market volatility—declined": an apposition between dashes right
 * after the acronym says what it is. It opens with an article and closes with a second dash, so a dash that only joins
 * two clauses ("the VIX—it fell") is not one.
 */
const DASH_GLOSS = /(?<![\p{L}\p{N}_&])(?<acronym>[A-Z][A-Z0-9&]{1,9})\s?[—–]\s?(?:an?|the)\s[^—–\n]{3,160}?[—–]/gu;

export const glossedAcronyms = (source: string): ReadonlySet<string> =>
  new Set([...source.matchAll(DASH_GLOSS)].flatMap((match) => match.groups?.["acronym"] ?? []));

/** Two letters are spelled by chance too often ("Data Protection" is not always DP). */
const MIN_SPELLED = 3;

/** Small words a name holds without an initial: "Bureau of Labor Statistics". */
const JOINERS: ReadonlySet<string> = new Set(["of", "and", "the", "for", "on", "in", "to", "&"]);

/**
 * The acronym a heading spells out when the heading is a name and nothing else ("## Federal Open Market Committee" →
 * FOMC): every word but the small ones is capitalised and gives one letter. A heading that holds other words ("Select
 * Open Source Software Licence", "Mission One: Transformed public services") names something else, and gives none.
 */
const spelledBy = (heading: string): string | undefined => {
  const words = heading.split(/\s+/u).filter((word) => word !== "" && !JOINERS.has(word));
  const named = words.length >= MIN_SPELLED && words.every((word) => /^\p{Lu}\p{Ll}*$/u.test(word));
  return named ? words.map((word) => word.charAt(0)).join("") : undefined;
};

/** Whether one of the headings spells out the acronym. The headings are read once, however many acronyms are asked about. */
export const headingsSpellingOut = (headings: readonly string[]): ((acronym: string) => boolean) => {
  const spelled = new Set(headings.flatMap((heading) => spelledBy(heading) ?? []));
  return (acronym) => spelled.has(acronym.replaceAll(/[^A-Z]/gu, ""));
};

/** The longest acronym read as spelled out in a sentence; a run of name words stops being followed past it. */
const MAX_SPELLED = 10;
/** A word that can be part of a name: a capital first, then letters, apostrophes, dots or hyphens (Nat'l, Comm'n, U.S.). */
const NAME_WORD = /^\p{Lu}[\p{L}'’.-]*$/u;
/** Marks before a word that are not part of it, and that open a new phrase: brackets and quotes. */
const OPENING_MARKS = /^[([“‘"']+/u;
const CLOSING_MARKS: ReadonlySet<string> = new Set(")]”’\"',.;:!?");

const withoutClosingMarks = (word: string): string => {
  const characters = [...word];
  return characters.slice(0, characters.findLastIndex((character) => !CLOSING_MARKS.has(character)) + 1).join("");
};
/** Punctuation after a word that ends the name it is in ("Administration,", "Mass.:"). The dot of an initialism (U.S.) does too. */
const NAME_BREAK = /[)\]”’",;:!?.]$/u;
/**
 * A bracket opened right after the name, or after more words of it, and still open at the acronym (Services (HHS and the
 * Department), Agency for Health (ARPA-H program), Agreement (hereinafter "SLA")): that is the bracketed expansion, which the
 * expansion reader decides, with its own conditions.
 */
const BRACKET_AFTER_NAME = /^[\s\p{L}'’.&-]*[(（][^)）]*$/u;
const SPELLED_ACRONYM = new RegExp(String.raw`(?<![\p{L}\p{N}_&])[A-Z]{${MIN_SPELLED},${MAX_SPELLED}}(?![\p{L}\p{N}_&])`, "gu");

type SentenceWord = { readonly core: string; readonly end: number; readonly opens: boolean; readonly closes: boolean };

const sentenceWords = (sentence: string): SentenceWord[] =>
  [...sentence.matchAll(/\S+/gu)].map((match) => {
    const core = withoutClosingMarks(match[0].replace(OPENING_MARKS, ""));
    const leading = match[0].length - match[0].replace(OPENING_MARKS, "").length;
    return { core, end: match.index + leading + core.length, opens: leading > 0, closes: NAME_BREAK.test(match[0]) };
  });

/** Initials and where they end, for the runs of name words that start at `from`. Small words join a run, never open or close one. */
type Spelled = { readonly letters: string; readonly end: number };

// A loop that stops at the run's end: slicing the rest of the sentence for every word would be quadratic in a long one.
const runsFrom = (words: readonly SentenceWord[], from: number): Spelled[] => {
  const runs: Spelled[] = [];
  const letters: string[] = [];
  for (let index = from; index < words.length && letters.length < MAX_SPELLED; index += 1) {
    const word = words[index];
    if (word === undefined || (index > from && word.opens)) break;
    const named = NAME_WORD.test(word.core);
    if (!named && (index === from || !JOINERS.has(word.core))) break;
    if (named) letters.push(word.core.charAt(0));
    if (named && letters.length >= MIN_SPELLED) runs.push({ letters: letters.join(""), end: word.end });
    if (word.closes) break;
  }
  return runs;
};

/**
 * Acronyms whose name is written out earlier in the same sentence, without brackets: a citation names the publisher and then
 * gives its short name ("U.S. Small Business Administration, … (Washington: SBA, August)", "(Nat'l Indian Gaming Comm'n May
 * 30, 2002) (NIGC Final Order)"). The name must give the acronym's letters word for word, and come before the acronym's first
 * use: a name written out only after the reader has met the acronym, or in another sentence, does not explain it.
 */
export const spelledInSentence = (sentences: readonly string[]): ReadonlySet<string> => {
  const seen = new Set<string>();
  const spelledFirst = new Set<string>();
  sentences.forEach((sentence) => {
    const acronyms = [...sentence.matchAll(SPELLED_ACRONYM)].filter((match) => !seen.has(match[0]));
    if (acronyms.length === 0) return;
    const words = sentenceWords(sentence);
    const spelled = words.flatMap((_, index) => runsFrom(words, index));
    acronyms.forEach((match) => {
      if (seen.has(match[0])) return;
      seen.add(match[0]);
      const spelledBefore = (name: Spelled): boolean =>
        name.letters === match[0] && name.end <= match.index && !BRACKET_AFTER_NAME.test(sentence.slice(name.end, match.index));
      if (spelled.some(spelledBefore)) spelledFirst.add(match[0]);
    });
  });
  return spelledFirst;
};

/** The acronyms the text explains without brackets: glossed between dashes, named earlier in the sentence, or a series cited by number. */
export const explainedInText = (body: string, sentences: readonly { readonly text: string }[]): ReadonlySet<string> =>
  new Set([...glossedAcronyms(body), ...spelledInSentence(sentences.map((sentence) => sentence.text)), ...numberedSeries(body)]);
