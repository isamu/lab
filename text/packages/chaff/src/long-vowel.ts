// The final long-vowel mark (ー) of katakana loanwords: how long a word is, and which written forms go against the chosen way.
// Pure: the words come in already picked from the document's tokens.

/** Small kana that join the kana before them into one mora (キャ, ファ, ウィ). ッ, ン and ー are morae of their own. */
const JOINING: ReadonlySet<string> = new Set(Array.from("ァィゥェォャュョヮぁぃぅぇぉゃゅょゎ"));

/** The number of morae (音) in a kana word: コンピューター is コ・ン・ピュ・ー・タ・ー, six. */
export const moraCount = (word: string): number => Array.from(word).filter((char) => !JOINING.has(char)).length;

const LONG_VOWEL = "ー";
const KATAKANA_WORD = /^[ァ-ヺー]+$/u;

/** A katakana word without its final ー: the part both ways of writing it share (コンピュータ for コンピューター). */
export const stemOf = (surface: string): string => {
  const chars = Array.from(surface);
  return chars.slice(0, chars.findLastIndex((char) => char !== LONG_VOWEL) + 1).join("");
};

/** Whether the surface is a katakana word with something besides ー in it. */
export const isKatakanaWord = (surface: string): boolean => KATAKANA_WORD.test(surface) && stemOf(surface) !== "";

/** A katakana word the rule reads: where it is, how it is written, and whether a final ー could be written or dropped. */
export type KanaWord = {
  readonly surface: string;
  readonly offset: number;
  /** Written with a final ー. */
  readonly long: boolean;
  /** Written without one, and the dictionary knows the form with one (the language adapter's LongVowelEnding=Dropped). */
  readonly dropped: boolean;
};

/**
 * The morae of the word before its final ー: カー is one, カバー two, コンピューター five. JIS Z 8301:2011 Table G.3 counts so:
 * カバー is its example of a word of two sounds or fewer, which keeps the ー.
 */
export const stemMorae = (surface: string): number => moraCount(stemOf(surface));

export type Ending = "consistent" | "drop" | "keep";

export type Odd = {
  readonly word: KanaWord;
  /** How the rule found it: same-word (one word written both ways), drop or keep (against the setting). */
  readonly variant: "same-word" | "drop" | "keep";
  /** The form the rule asks for. */
  readonly preferred: string;
  /** For same-word: how many times the word is written the way this one is, and how many times in all. */
  readonly count: number;
  readonly of: number;
};

const otherForm = (word: KanaWord): string => (word.long ? stemOf(word.surface) : `${word.surface}${LONG_VOWEL}`);

/** The side written less; on a tie, the side the document did not use first. undefined when only one side is used. */
const minorityLong = (words: readonly KanaWord[]): boolean | undefined => {
  const long = words.filter((word) => word.long).length;
  const short = words.length - long;
  if (long === 0 || short === 0) return undefined;
  if (long !== short) return long < short;
  return !(words[0]?.long ?? false);
};

const minorityOf = (words: readonly KanaWord[], variant: Odd["variant"]): Odd[] => {
  const minority = minorityLong(words);
  if (minority === undefined) return [];
  const odd = words.filter((word) => word.long === minority);
  return odd.map((word) => ({ word, variant, preferred: otherForm(word), count: odd.length, of: words.length }));
};

/** The document's words grouped by the part both ways share (コンピュータ with コンピューター). */
const sameWordGroups = (words: readonly KanaWord[]): KanaWord[][] => {
  const groups = new Map<string, KanaWord[]>();
  words.forEach((word) => {
    const stem = stemOf(word.surface);
    const group = groups.get(stem);
    if (group === undefined) groups.set(stem, [word]);
    else group.push(word);
  });
  return [...groups.values()];
};

/**
 * With no side taken: a word written both ways (コンピュータ and コンピューター), at its fewer form. Different words are not compared:
 * a document may write サーバー and ブラウザ by each word's usual spelling, and no guideline makes that a mistake.
 */
const inconsistent = (words: readonly KanaWord[]): Odd[] => sameWordGroups(words).flatMap((group) => minorityOf(group, "same-word"));

/** Whether drop reaches the word: its final ー follows one of the kana the guideline drops it after (ア段: -er, -or, -ar). Any, when none are given. */
const droppable = (word: KanaWord, dropAfter: ReadonlySet<string> | undefined): boolean =>
  dropAfter === undefined || dropAfter.has(Array.from(stemOf(word.surface)).at(-1) ?? "");

/**
 * The words that go against the chosen way. drop: a word of minMorae or more written with its final ー after a kana of dropAfter.
 * keep: a word written without one where the dictionary, or the document itself, has the form with one. consistent: see inconsistent.
 * Words shorter than minMorae are left alone whichever way: the guidelines that drop the ー keep it on them (カー, カバー).
 */
export const oddLongVowels = (words: readonly KanaWord[], ending: Ending, minMorae: number, dropAfter?: ReadonlySet<string>): Odd[] => {
  const counted = words.filter((word) => stemMorae(word.surface) >= minMorae);
  if (ending === "drop")
    return counted
      .filter((word) => word.long && droppable(word, dropAfter))
      .map((word) => ({ word, variant: "drop", preferred: otherForm(word), count: 0, of: 0 }));
  if (ending === "keep") {
    const longStems = new Set(counted.filter((word) => word.long).map((word) => stemOf(word.surface)));
    return counted
      .filter((word) => !word.long && (word.dropped || longStems.has(word.surface)))
      .map((word) => ({ word, variant: "keep", preferred: otherForm(word), count: 0, of: 0 }));
  }
  return inconsistent(counted).toSorted((left, right) => left.word.offset - right.word.offset);
};
