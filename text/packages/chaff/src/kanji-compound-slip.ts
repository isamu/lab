// A long kanji compound the document writes several times, and once or twice with one kanji changed (就職氷河期世代 ×5,
// 就職永河期世代 ×2). Pure: the compounds come in with the words the analyser cut them into; which kanji may differ by
// design (一, 第, 条) comes from a word list.

/** One word of the analyser inside a compound, by kanji index: [start, end). `known` is false for a word not in its dictionary. */
export type CompoundWord = {
  readonly start: number;
  readonly end: number;
  readonly known: boolean;
  /** The word reaches past the run (並びに after 受遺者); only its part inside is given. */
  readonly crossesRun?: boolean;
};

export type CompoundUse = {
  readonly compound: string;
  readonly offset: number;
  /** Absent where nothing was analysed. */
  readonly words?: readonly CompoundWord[] | undefined;
};

type CompoundSlip = {
  readonly written: string;
  readonly usual: string;
  readonly usualCount: number;
  readonly offset: number;
  readonly index: number;
};

const MIN_COMPOUND_LENGTH = 4;
const MIN_USUAL_COUNT = 3;
/** A slip copied once (a link and its twin) is still a slip; the usual form must then be written more than twice as often. */
const MAX_SLIP_COUNT = 2;

/** The one position where two compounds of the same length differ, or undefined when they differ in none or several. */
export const singleDifference = (left: readonly string[], right: readonly string[]): number | undefined => {
  if (left.length !== right.length) return undefined;
  const differing = left.flatMap((char, index) => (char === right[index] ? [] : [index]));
  return differing.length === 1 ? differing[0] : undefined;
};

/** The first and last kanji of a run are where a suffix (等, 者) or a conjunction written in kanji (及, 又) joins, not where a word is mistyped. */
const isInside = (index: number, length: number): boolean => index > 0 && index < length - 1;

const wordAt = (use: CompoundUse, index: number): CompoundWord | undefined => use.words?.find((word) => word.start <= index && index < word.end);

const isLooseWithin = (word: CompoundWord | undefined, outer: CompoundWord): boolean =>
  word !== undefined && word.crossesRun !== true && (!word.known || word.end - word.start === 1) && word.start >= outer.start && word.end <= outer.end;

/**
 * The analyser cannot read the changed word: where the usual form holds the kanji inside one word (氷河期), the slip
 * falls apart there into single kanji or words it does not know (永 / 河 / 期). Returns the slip's kanji over that word.
 */
export const fallenWord = (slip: CompoundUse, usualUses: readonly CompoundUse[], index: number): string | undefined => {
  const usualWord = usualUses.map((use) => wordAt(use, index)).find((word) => word !== undefined && word.end - word.start > 1);
  if (usualWord === undefined) return undefined;
  const positions = Array.from({ length: usualWord.end - usualWord.start }, (_, offset) => usualWord.start + offset);
  const apart = positions.every((position) => isLooseWithin(wordAt(slip, position), usualWord));
  return apart ? Array.from(slip.compound).slice(usualWord.start, usualWord.end).join("") : undefined;
};

/** The changed word written in another kanji run (質権 in 質権者は beside 当該質権者): a word the document knows. */
const isWrittenElsewhere = (word: string, slip: string, uses: readonly CompoundUse[]): boolean =>
  uses.some((use) => use.compound !== slip && use.compound.includes(word));

type SlipContext = { readonly ignored: ReadonlySet<string>; readonly uses: readonly CompoundUse[] };

type Usual = { readonly compound: string; readonly count: number; readonly uses: readonly CompoundUse[] };

const countsOf = (uses: readonly CompoundUse[]): ReadonlyMap<string, number> =>
  uses.reduce((counts, use) => counts.set(use.compound, (counts.get(use.compound) ?? 0) + 1), new Map<string, number>());

const usualsOf = (uses: readonly CompoundUse[], counts: ReadonlyMap<string, number>): Usual[] =>
  [...counts]
    .filter(([compound, count]) => count >= MIN_USUAL_COUNT && Array.from(compound).length >= MIN_COMPOUND_LENGTH)
    .map(([compound, count]) => ({ compound, count, uses: uses.filter((use) => use.compound === compound) }));

const slipAgainst = (use: CompoundUse, count: number, usual: Usual, context: SlipContext): CompoundSlip | undefined => {
  const [written, other] = [Array.from(use.compound), Array.from(usual.compound)];
  const index = usual.count > count * 2 ? singleDifference(written, other) : undefined;
  if (index === undefined || !isInside(index, written.length)) return undefined;
  if (context.ignored.has(written[index] ?? "") || context.ignored.has(other[index] ?? "")) return undefined;
  const fallen = fallenWord(use, usual.uses, index);
  if (fallen === undefined || isWrittenElsewhere(fallen, use.compound, context.uses)) return undefined;
  return { written: use.compound, usual: usual.compound, usualCount: usual.count, offset: use.offset, index };
};

/** Each compound written once or twice that differs in one kanji from a compound of the same length written at least three times. */
export const compoundSlipsIn = (uses: readonly CompoundUse[], ignored: ReadonlySet<string>): CompoundSlip[] => {
  const counts = countsOf(uses);
  const usuals = usualsOf(uses, counts);
  if (usuals.length === 0) return [];
  return uses.flatMap((use) => {
    const count = counts.get(use.compound) ?? 0;
    if (count > MAX_SLIP_COUNT || Array.from(use.compound).length < MIN_COMPOUND_LENGTH) return [];
    const slips = usuals.flatMap((usual) => slipAgainst(use, count, usual, { ignored, uses }) ?? []);
    return slips.length === 1 ? slips : [];
  });
};
