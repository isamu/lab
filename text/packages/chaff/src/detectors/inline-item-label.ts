// Bracketed item numbers inside a line, where a report joined into one line or a clause's address in the prose sets them:
// "。(2)目標" opens an item after a sentence, "まで(2)行使価額" continues a run of numbered items, and "第3条(a)(1)" or
// "(b)(1)および(2)" addresses an article's clauses. Each follows the notation of the labels, not the prose's brackets. Pure.

/** A short text between two brackets of one width; whether it is a label is the caller's to say. */
const PAIR = /\(([^()（）\s]{1,4})\)|（([^()（）\s]{1,4})）/gu;

type Pair = { readonly open: number; readonly close: number; readonly inner: string };

/** A sentence's end right before the bracket: the item opens a sentence of a joined line. */
const AFTER_SENTENCE = /[。．！？]$/u;

/** A section's number, with one word after it (第3条, 4), right before the bracket: not inside a figure (1,054). */
const AFTER_NUMBER = /(?<![0-9０-９,，.．])[0-9０-９]{1,3}\p{Script=Han}?$/u;

/** How far before a bracket the address's number is read. */
const NUMBER_REACH = 5;

/** A word right after the bracket in hiragana: the prose refers to the item ((2)を参照), it does not open one. */
const PARTICLE_AFTER = /^\p{Script=Hiragana}/u;

const FULL_WIDTH_ZERO = 0xff10;
const ASCII_ZERO = 0x30;

const valueOf = (inner: string): number | undefined => {
  const digits = inner.replace(/[０-９]/gu, (digit) => String.fromCharCode(digit.charCodeAt(0) - FULL_WIDTH_ZERO + ASCII_ZERO));
  return /^\d+$/u.test(digits) ? Number(digits) : undefined;
};

const pairsOf = (source: string, isLabel: (inner: string) => boolean): Pair[] =>
  [...source.matchAll(PAIR)].flatMap((match) => {
    const inner = match[1] ?? match[2] ?? "";
    return isLabel(inner) ? [{ open: match.index, close: match.index + match[0].length - 1, inner }] : [];
  });

/** The next number of the run, in the same width, opening a word rather than taking a particle. */
const continuesRun = (source: string, previous: Pair, pair: Pair): boolean => {
  const before = valueOf(previous.inner);
  return (
    before !== undefined &&
    valueOf(pair.inner) === before + 1 &&
    source[previous.open] === source[pair.open] &&
    !PARTICLE_AFTER.test(source.slice(pair.close + 1, pair.close + 2))
  );
};

/** Two labels side by side ((a)(1)), or joined by a conjunction or a list mark ((1)および(2)): one address. */
const joinsAddress = (source: string, previous: Pair, pair: Pair, joiners: ReadonlySet<string>): boolean =>
  previous.close + 1 === pair.open || joiners.has(source.slice(previous.close + 1, pair.open));

const afterSentence = (source: string, at: number): boolean => AFTER_SENTENCE.test(source.slice(Math.max(0, at - 1), at));

/** A short text between two brackets of either width. */
const EITHER_WIDTH = /[(（]([^()（）\s]{1,4})[)）]/gu;

/**
 * Whether every item number opening a sentence is written in one shape ((1) throughout). A document that writes them two ways
 * ((1）, (5)) has no labels' notation of its own to set apart: its odd label is a slip among the brackets.
 */
const oneShapeAfterSentences = (source: string, isLabel: (inner: string) => boolean): boolean =>
  new Set(
    [...source.matchAll(EITHER_WIDTH)]
      .filter((match) => isLabel(match[1] ?? "") && afterSentence(source, match.index))
      .map((match) => `${match[0].charAt(0)}${match[0].at(-1) ?? ""}`),
  ).size <= 1;

const opensItem = (source: string, pair: Pair, seeds: ReadonlySet<number>, sentenceHeads: boolean): boolean =>
  seeds.has(pair.open) ||
  (sentenceHeads && afterSentence(source, pair.open)) ||
  AFTER_NUMBER.test(source.slice(Math.max(0, pair.open - NUMBER_REACH), pair.open));

const LIST_MARKS = ["、", "・"];

/**
 * The offsets of the brackets of every item number set inside a line, given what counts as a label, the offsets of the labels
 * already found at the lines' heads, and the conjunctions that join a list (および).
 */
export const inlineItemLabelOffsets = (
  source: string,
  isLabel: (inner: string) => boolean,
  seeds: ReadonlySet<number>,
  conjunctions: readonly string[],
): ReadonlySet<number> => {
  const joiners = new Set([...conjunctions, ...LIST_MARKS]);
  const pairs = pairsOf(source, isLabel);
  const sentenceHeads = oneShapeAfterSentences(source, isLabel);
  const chained = pairs.map((pair, at) => {
    const next = pairs[at + 1];
    return next !== undefined && pair.close + 1 === next.open;
  });
  const marked = pairs.reduce<boolean[]>((found, pair, at) => {
    const previous = pairs[at - 1];
    const linked = previous !== undefined && found[at - 1] === true && (continuesRun(source, previous, pair) || joinsAddress(source, previous, pair, joiners));
    found.push(linked || chained[at] === true || chained[at - 1] === true || opensItem(source, pair, seeds, sentenceHeads));
    return found;
  }, []);
  return new Set(pairs.flatMap((pair, at) => (marked[at] === true ? [pair.open, pair.close] : [])));
};
