// A plural figure-label word and the numbers after it ("Tables 14 and 17", "Figures 2 through 4"): a reference to each of
// those figures. Pure; the words come from the language's figure-label-plural and figure-number-joiner lexicons.
import { escapeRegExp } from "../orthography.ts";
import type { Mention } from "../figure-references.ts";
import type { ProseDocument, Span } from "../plugin.ts";

export type FigureListWords = {
  /** A plural word and the figure-label word it stands for (Tables → Table). */
  readonly plurals: readonly { readonly word: string; readonly kind: string }[];
  /** Joiners that name each number (and, a comma). */
  readonly list: readonly string[];
  /** Joiners that span every number from the one before to the one after (through, –). */
  readonly ranges: readonly string[];
  /** A word after the numbers that makes them another document's figures (of, in). */
  readonly elsewhere: readonly string[];
};

/** As a singular reference reads it: a hyphen joins a sub-number (Table 2-1), so it is no range here. */
const NUMBER = String.raw`\p{Nd}+(?:[.\-－]\p{Nd}+)*`;
/** A range wider than this is not a range of figures ("Tables 1 to 2020"). */
const MAX_RANGE = 50;

/** As written, or in capitals (TABLES 1 AND 2), as a singular label is matched. */
const forms = (words: readonly string[]): string[] => [...new Set(words.flatMap((word) => [word, word.toUpperCase()]))];

const alternation = (words: readonly string[]): string =>
  forms(words)
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");

const listPattern = (words: FigureListWords): RegExp => {
  const joiner = alternation([...words.list, ...words.ranges]);
  const next = String.raw`\s*(?:,\s*)?(?:${joiner})\s*${NUMBER}[a-z]?`;
  return new RegExp(String.raw`(?<![\p{L}\p{N}])(${alternation(words.plurals.map((plural) => plural.word))})[ \u00a0](${NUMBER}[a-z]?(?:${next})*)`, "gu");
};

const isInteger = (number: string): boolean => /^\d+$/u.test(number);

/** "14 through 17" as 14, 15, 16, 17; a range that is not two whole numbers in order, or is too wide, as its two ends. */
const spread = (from: string, to: string): string[] => {
  if (!isInteger(from) || !isInteger(to)) return [to];
  const [low, high] = [Number(from), Number(to)];
  if (high <= low || high - low > MAX_RANGE) return [to];
  return Array.from({ length: high - low }, (_, index) => String(low + index + 1));
};

/** The numbers a run names, in the order written, a range spread out. */
export const numbersOfList = (run: string, words: FigureListWords): string[] => {
  const token = new RegExp(`(${NUMBER})[a-z]?|(${alternation([...words.list, ...words.ranges])})`, "gu");
  return [...run.matchAll(token)].reduce<{ readonly numbers: string[]; readonly inRange: boolean }>(
    (state, match) => {
      const number = match[1]?.normalize("NFKC");
      if (number === undefined) return { numbers: state.numbers, inRange: forms(words.ranges).includes(match[2] ?? "") };
      const last = state.numbers.at(-1);
      const named = state.inRange && last !== undefined ? spread(last, number) : [number];
      return { numbers: [...state.numbers, ...named], inRange: false };
    },
    { numbers: [], inRange: false },
  ).numbers;
};

const LATIN_WORD = /^[A-Za-z]/u;

const pointsElsewhere = (text: string, end: number, elsewhere: readonly string[]): boolean => {
  const after = text.slice(end);
  const trimmed = after.trimStart();
  return elsewhere.some((word) => after !== trimmed && trimmed.startsWith(word) && !LATIN_WORD.test(trimmed.slice(word.length)));
};

/**
 * Each figure a plural reference names, as a mention at the plural word, in the order written. Not inside a link, and not
 * when the numbers go on to name another document ("Tables 3 and 4 of the report").
 */
export const figureListMentions = (prose: string, words: FigureListWords, links: readonly Span[] = []): Mention[] => {
  if (words.plurals.length === 0 || words.list.length + words.ranges.length === 0) return [];
  return [...prose.matchAll(listPattern(words))].flatMap((match) => {
    const end = match.index + match[0].length;
    if (pointsElsewhere(prose, end, words.elsewhere) || links.some((link) => link.start <= match.index && end <= link.end)) return [];
    const kind = words.plurals.find((plural) => forms([plural.word]).includes(match[1] ?? ""))?.kind ?? match[1] ?? "";
    return numbersOfList(match[2] ?? "", words).map((number) => ({
      start: match.index,
      end,
      written: `${kind} ${number}`,
      key: `${kind}\u0000${number}`,
      kind,
    }));
  });
};

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

export const figureListWordsOf = (doc: ProseDocument): FigureListWords => {
  const joiners = doc.lexicons["figure-number-joiner"] ?? [];
  return {
    plurals: (doc.lexicons["figure-label-plural"] ?? []).map((entry) => ({ word: entry.pattern, kind: entry.instead_of ?? entry.pattern })),
    list: joiners.filter((entry) => entry.group !== "range").map((entry) => entry.pattern),
    ranges: joiners.filter((entry) => entry.group === "range").map((entry) => entry.pattern),
    elsewhere: patternsOf(doc, "figure-elsewhere"),
  };
};
