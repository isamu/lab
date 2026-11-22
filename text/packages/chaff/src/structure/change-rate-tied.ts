// change-rate-mismatch: the earlier value written without its noun ("1,300 companies, up 20% from 1,000", "Visits reached
// 186,400, up 12% from 152,800 the year before"). The shape "<value>, <direction> <rate> <from> <value>" ties the two
// numbers to one quantity, so the bare one is read in the other's unit. Pure; the detector supplies the parts.
import type { Span } from "../plugin.ts";
import type { BaseMark, Direction, Figure, Rate } from "./change-rate.ts";

export type TieText = {
  readonly source: string;
  readonly rates: readonly Rate[];
  readonly directions: readonly Direction[];
  /** Words that mark the earlier value ("from"); only those standing before the value are read. */
  readonly marks: readonly BaseMark[];
  /** Numbers counted with the word after them ("1,300 companies"), whose value is the number as written. */
  readonly counted: readonly Figure[];
  /** Spans of the tree's quantities ($1,000, 20%): a number inside one has a unit of its own. */
  readonly quantities: readonly Span[];
  /** The marks and words of a percentage (%, percent), which the tree leaves outside the rate's span. */
  readonly percentWords: readonly string[];
  /** Words of magnitude (million): a number followed by one is not its written value. */
  readonly multipliers: readonly string[];
  /** Whether the word starting at offset is a noun; undefined when the tagger did not say. */
  readonly isNounAt: (offset: number) => boolean | undefined;
};

type Bare = Span & { readonly value: number; readonly step: number };

const NUMBER = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?`;
const NUMBER_AT_END = new RegExp(String.raw`(?<![\w.,$€£¥-])${NUMBER}$`, "u");
const NUMBER_AT_START = new RegExp(String.raw`^\s+${NUMBER}(?![\d%]|[.,]\d)`, "u");
const COMMA_AT_END = /,\s+$/u;
const SPACE = /^\s+$/u;
const WORD_AFTER = /^(\s+)([A-Za-z]+)/u;
const ONE_WORD = /^\s+[A-Za-z]+$/u;
const YEAR = /^(?:1[89]|2[01])\d{2}$/u;
const DECIMAL_BASE = 10;
/** How far from the rate's words a value is looked for: a number and one word, then the comma; or space and a number. */
const CURRENT_WINDOW = 64;

const bareOf = (span: Span, digits: string, decimals: string): Bare => {
  const written = [digits.replaceAll(",", ""), decimals].filter((part) => part !== "").join(".");
  return { ...span, value: Number(written), step: DECIMAL_BASE ** -decimals.length };
};

/** A number written plainly: not a year, no word of magnitude after it, not inside one of the tree's quantities. */
const isPlain = (text: TieText, bare: Bare): boolean => {
  const word = WORD_AFTER.exec(text.source.slice(bare.end))?.[2]?.toLowerCase() ?? "";
  const inQuantity = text.quantities.some((span) => span.start < bare.end && bare.start < span.end);
  return !inQuantity && !text.multipliers.includes(word) && !YEAR.test(text.source.slice(bare.start, bare.end));
};

/** The number right after the mark of the earlier value ("from 1,000"). */
const baseAfter = (text: TieText, mark: BaseMark): Bare | undefined => {
  const match = NUMBER_AT_START.exec(text.source.slice(mark.end, mark.end + CURRENT_WINDOW));
  if (match === null) return undefined;
  const end = mark.end + match[0].length;
  const start = end - match[0].trimStart().length;
  const bare = bareOf({ start, end }, match[1] ?? "", match[2] ?? "");
  return isPlain(text, bare) ? bare : undefined;
};

/** The current value right before ", <direction>": a counted figure ("1,300 companies") or a bare number ("186,400"). */
const currentBefore = (text: TieText, direction: Direction): Figure | Bare | undefined => {
  const from = Math.max(0, direction.start - CURRENT_WINDOW);
  const comma = COMMA_AT_END.exec(text.source.slice(from, direction.start));
  if (comma === null) return undefined;
  const end = from + comma.index;
  const counted = text.counted.find((figure) => figure.end < end && end - figure.end <= CURRENT_WINDOW && ONE_WORD.test(text.source.slice(figure.end, end)));
  if (counted !== undefined) return counted;
  const match = NUMBER_AT_END.exec(text.source.slice(from, end));
  if (match === null || match.index === 0) return undefined;
  const bare = bareOf({ start: from + match.index, end }, match[1] ?? "", match[2] ?? "");
  return isPlain(text, bare) ? bare : undefined;
};

/** Only space, after the rate's mark of percentage, between the rate and the word after it ("20% from"). */
const followsRate = (text: TieText, rate: Rate, word: Span): boolean => {
  const gap = text.source.slice(rate.end, word.start).trimStart();
  const unit = text.percentWords.find((percent) => gap.startsWith(percent)) ?? "";
  return SPACE.test(gap.slice(unit.length));
};

const isFigure = (value: Figure | Bare): value is Figure => "unit" in value;

/** A number already counted with a noun of its own ("from 1,000 dollars"), not with a word the tagger calls no noun ("the"). */
const countedWithNoun = (text: TieText, bare: Bare): boolean => {
  const counted = text.counted.find((figure) => figure.start === bare.start);
  const word = WORD_AFTER.exec(text.source.slice(bare.end));
  return counted !== undefined && text.isNounAt(bare.end + (word?.[1]?.length ?? 0)) !== false;
};

/**
 * The figures one rate ties: the bare earlier value in the counted current value's unit, or both bare values in a unit of
 * their own. An earlier value counted with a noun of its own is left as it is.
 */
const tieAt = (text: TieText, rate: Rate): Figure[] => {
  const direction = text.directions.find((word) => word.end <= rate.start && SPACE.test(text.source.slice(word.end, rate.start)));
  const mark = text.marks.find((word) => word.position === "before" && rate.end <= word.start && followsRate(text, rate, word));
  const base = mark === undefined ? undefined : baseAfter(text, mark);
  const current = direction === undefined ? undefined : currentBefore(text, direction);
  if (base === undefined || current === undefined || countedWithNoun(text, base)) return [];
  if (isFigure(current)) return [{ ...base, unit: current.unit }];
  const unit = `tied|${String(rate.start)}`;
  return [
    { ...current, unit },
    { ...base, unit },
  ];
};

/** The figures, with each tied value added or put in place of the one read at the same place. */
export const withTiedFigures = (text: TieText, figures: readonly Figure[]): Figure[] => {
  const tied = text.rates.flatMap((rate) => tieAt(text, rate));
  return [...figures.filter((figure) => !tied.some((one) => one.start === figure.start)), ...tied];
};
