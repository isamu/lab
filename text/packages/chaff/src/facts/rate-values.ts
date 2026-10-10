import type { FactValue } from "./fact-values.ts";
import { EDGE_MARKS, trimEndOf } from "./trim-marks.ts";

/**
 * 率（百分率）の値のまわりに書く、値を変えない語。期間（年3.6%、4.8% per year）、種類（固定、variable）、何に対する率
 * （of the purchase price）、括弧の注記（3.6%（固定金利））。これらを越えた所で値が終わっていれば、率は名前の値として読む。
 * 語彙表に無い語が続く率（3.6% of applicants、3.6%増）は、別の量の一部なので読まない。
 * 期間・種類・対象は値の基準（basis）になり、両方に書いてあって違えば別の量として比べない（月0.5% と 年6%）。
 * 語彙表に無い括弧の注記（(of applicants)、(men)）は、同じ注記の率とだけ比べる。何の率かを言っているかもしれない。
 */
export type RateWord = { readonly pattern: string; readonly group?: string | undefined; readonly position: "before" | "after" };

export type RateWords = {
  /** 百分率の単位（%、パーセント）。 */
  readonly units: readonly string[];
  /** 基準の語彙表ごとの語。鍵は基準の種類（period、kind、base）。 */
  readonly notes: Readonly<Record<string, readonly RateWord[]>>;
  /** 率のすぐ後ろで、値を言い終えて次の節を始める語句（and stays、and does not）。 */
  readonly joiners: readonly string[];
};

/** 基準の種類と、その値（period:year）。 */
export type RateBasis = readonly string[];

const OPEN_BRACKETS: ReadonlySet<string> = new Set(["(", "（"]);
const CLOSE_BRACKETS = /[)）]/u;
const NESTED_OR_LINE = /[(（\n]/u;
const SPACES = /^[ \t]*/u;
const LATIN_LETTER = /[a-z]/iu;
/** 語彙表に無い括弧の注記の基準。この基準だけは、片方に無くても食い違いとする。 */
const NOTE = "note:";

const normalized = (text: string): string => text.normalize("NFKC").toLowerCase();

export const isRate = (value: FactValue, words: RateWords): boolean =>
  value.kind === "quantity" && words.units.some((unit) => normalized(unit) === normalized(value.unit));

const basisOf = (dimension: string, word: RateWord): RateBasis => (word.group === undefined ? [] : [`${dimension}:${word.group}`]);

type NoteMatch = { readonly length: number; readonly basis: RateBasis };

/** 英字で終わる語は、語の途中で切れていないこと（a year を a yearly の頭として読まない）。 */
const endsWord = (text: string, length: number): boolean => !(LATIN_LETTER.test(text.charAt(length - 1)) && LATIN_LETTER.test(text.charAt(length)));

const longestOf = (matches: readonly NoteMatch[]): NoteMatch | undefined =>
  matches.reduce<NoteMatch | undefined>((longest, match) => (longest === undefined || match.length > longest.length ? match : longest), undefined);

/** 基準の語のうち、置く側が position のもの（undefined ならどちらでも）を、語彙表の種類と組にして。 */
const notesAt = (words: RateWords, position: RateWord["position"] | undefined): { readonly dimension: string; readonly word: RateWord }[] =>
  Object.entries(words.notes).flatMap(([dimension, entries]) =>
    entries.filter((word) => position === undefined || word.position === position).map((word) => ({ dimension, word })),
  );

/** text の頭に置いた基準の語のうち一番長いもの。 */
const noteAtStart = (text: string, words: RateWords, position: RateWord["position"] | undefined): NoteMatch | undefined =>
  longestOf(
    notesAt(words, position)
      .filter(({ word }) => normalized(text.slice(0, word.pattern.length)) === normalized(word.pattern) && endsWord(text, word.pattern.length))
      .map(({ dimension, word }): NoteMatch => ({ length: word.pattern.length, basis: basisOf(dimension, word) })),
  );

/** 頭の括弧の注記。中身が基準の語そのもの（（固定金利）、(fixed)）なら、その基準も。行をまたぐ括弧や入れ子は注記にしない。 */
const bracketAtStart = (text: string, words: RateWords): NoteMatch | undefined => {
  if (!OPEN_BRACKETS.has(text.charAt(0))) return undefined;
  const close = text.search(CLOSE_BRACKETS);
  const inside = close === -1 ? "" : text.slice(1, close);
  if (close === -1 || NESTED_OR_LINE.test(inside)) return undefined;
  const whole = noteAtStart(inside, words, undefined);
  return { length: close + 1, basis: whole?.length === inside.length ? whole.basis : [`${NOTE}${normalized(inside).trim()}`] };
};

export type RateTail = { readonly end: number; readonly basis: RateBasis };

/** 率の後ろの、値を変えない語と括弧の注記を越えた所と、そこまでに書いた基準。 */
const tailFrom = (source: string, tail: RateTail, words: RateWords): RateTail => {
  const text = source.slice(tail.end).replace(SPACES, "");
  const note = bracketAtStart(text, words) ?? noteAtStart(text, words, "after");
  if (note === undefined) return tail;
  return tailFrom(source, { end: source.length - text.length + note.length, basis: [...tail.basis, ...note.basis] }, words);
};

export const rateTail = (source: string, value: FactValue, words: RateWords): RateTail => tailFrom(source, { end: value.end, basis: [] }, words);

export type RateHead = { readonly head: string; readonly basis: RateBasis };

/** 率の前の期間の語（年3.6% の 年）を、名前の側から外したものと、その基準。 */
export const rateHead = (head: string, words: RateWords): RateHead => {
  const trimmed = trimEndOf(head, EDGE_MARKS);
  const found = longestOf(
    notesAt(words, "before")
      .filter(({ word }) => normalized(trimmed.slice(-word.pattern.length)) === normalized(word.pattern))
      .map(({ dimension, word }): NoteMatch => ({ length: word.pattern.length, basis: basisOf(dimension, word) })),
  );
  if (found === undefined) return { head, basis: [] };
  return { head: trimEndOf(trimmed.slice(0, trimmed.length - found.length), EDGE_MARKS), basis: found.basis };
};

/** 率の後ろが、値を言い終えて次の節を始める語句（4.5% and does not change）。語句の後ろは語の切れ目。 */
export const joinsNextClause = (source: string, end: number, words: RateWords): boolean => {
  const text = source.slice(end).replace(SPACES, "");
  return words.joiners.some((phrase) => normalized(text.slice(0, phrase.length)) === normalized(phrase) && endsWord(text, phrase.length));
};

const dimensionOf = (entry: string): string => entry.slice(0, entry.indexOf(":") + 1);

const notesOf = (basis: RateBasis): string =>
  basis
    .filter((entry) => entry.startsWith(NOTE))
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .join("\u0000");

/** 二つの値の基準が食い違わないか。同じ種類の基準を両方に書いて違うか、語彙表に無い注記が揃わないときに食い違う。 */
export const basesAgree = (left: RateBasis | undefined, right: RateBasis | undefined): boolean => {
  const [ours, theirs] = [left ?? [], right ?? []];
  if (notesOf(ours) !== notesOf(theirs)) return false;
  return ours.every((entry) => !theirs.some((other) => dimensionOf(other) === dimensionOf(entry) && other !== entry));
};
