import type { FactValue } from "./fact-values.ts";

/**
 * 年齢の値（満70歳、20歳、aged 40、30 years old）と、年齢の上限（満70歳まで、up to the age of 70）、年齢の範囲（満20歳〜満70歳、
 * aged 20 to 70）。値を年齢の印の語まで延ばし、数だけの値として読む（年齢は、年齢の行の升の 70 と同じもの）。
 * 範囲は上の端を値にして、下の端を lower に持つ。範囲と上限は、どちらも加入できる上の年齢を言うので上の端で比べる。
 * 一人の年齢（20歳）は範囲の中のどれでもありうるので、範囲とは比べない（comparable）。
 */
export type AgeWord = { readonly pattern: string; readonly position: "before" | "after" };

export type AgeWords = {
  /** 年齢の印（満、歳、aged、the age of、years old）。 */
  readonly marks: readonly AgeWord[];
  /** 上限の印（まで、以下、up to、or under）。 */
  readonly limits: readonly AgeWord[];
  /** 二つの年齢のあいだに置いて範囲を言う語（〜、から、to）。 */
  readonly joiners: readonly string[];
};

/** 印まで延ばした値と、印があったか。 */
type Marked = { readonly age: FactValue; readonly marked: boolean };

const folded = (text: string): string => text.normalize("NFKC").toLowerCase();

const LATIN_LETTER = /[a-z]/iu;
const GAPS = new Set([" ", "\t"]);

const isLatin = (char: string): boolean => LATIN_LETTER.test(char);

/** 語の前の字。英字の語は、前が英字でないときだけ語の頭。 */
const startsWord = (source: string, at: number, pattern: string): boolean => !(isLatin(pattern.charAt(0)) && isLatin(source.charAt(at - 1)));

const endsWord = (source: string, at: number, pattern: string): boolean => !(isLatin(pattern.slice(-1)) && isLatin(source.charAt(at)));

/** at の前に書いた一番長い語の始まり。英字の語の後ろの空白一つは飛ばす。 */
const wordBefore = (source: string, at: number, patterns: readonly string[]): number | undefined =>
  patterns
    .flatMap((pattern) => {
      const gap = isLatin(pattern.slice(-1)) && GAPS.has(source.charAt(at - 1)) ? 1 : 0;
      const from = at - gap - pattern.length;
      const written = from >= 0 && folded(source.slice(from, at - gap)) === folded(pattern);
      return written && startsWord(source, from, pattern) ? [from] : [];
    })
    .reduce<number | undefined>((earliest, from) => (earliest === undefined || from < earliest ? from : earliest), undefined);

/** at の後ろに書いた一番長い語の終わり。英字の語の前の空白一つは飛ばす。 */
const wordAfter = (source: string, at: number, patterns: readonly string[]): number | undefined =>
  patterns
    .flatMap((pattern) => {
      const gap = isLatin(pattern.charAt(0)) && GAPS.has(source.charAt(at)) ? 1 : 0;
      const to = at + gap + pattern.length;
      const written = folded(source.slice(at + gap, to)) === folded(pattern);
      return written && endsWord(source, to, pattern) ? [to] : [];
    })
    .reduce<number | undefined>((latest, to) => (latest === undefined || to > latest ? to : latest), undefined);

const at = (words: readonly AgeWord[], position: AgeWord["position"]): string[] =>
  words.filter((word) => word.position === position).map((word) => word.pattern);

/** 値の字の終わりにすでに年齢の印がある（70歳）。 */
const endsWithMark = (source: string, value: FactValue, marks: readonly string[]): boolean =>
  marks.some((mark) => folded(source.slice(value.start, value.end)).endsWith(folded(mark)));

/** 単位の無い数か、単位が年齢の印の頭（30 years old の years）か、印で終わる値（70歳）だけが年齢になりうる。 */
const mayBeAge = (source: string, value: FactValue, after: readonly string[]): boolean =>
  value.kind === "quantity" && (value.unit === "" || endsWithMark(source, value, after) || after.some((mark) => folded(mark).startsWith(folded(value.unit))));

/** 年齢の印まで延ばした値。印が無ければ marked は false（範囲の片方なら年齢として読む）。 */
const markedAge = (source: string, value: FactValue, words: AgeWords): Marked => {
  const after = at(words.marks, "after");
  const inside = endsWithMark(source, value, after);
  const end = inside ? value.end : wordAfter(source, value.end, after);
  const start = wordBefore(source, value.start, at(words.marks, "before"));
  const age: FactValue = { ...value, start: start ?? value.start, end: end ?? value.end, unit: "" };
  return { age, marked: inside || start !== undefined || end !== undefined };
};

/** 上限の印まで延ばした値。印があれば上の端。 */
const withLimit = (source: string, value: FactValue, words: AgeWords): FactValue => {
  const start = wordBefore(source, value.start, at(words.limits, "before"));
  const end = wordAfter(source, value.end, at(words.limits, "after"));
  if (start === undefined && end === undefined) return value;
  return { ...value, start: start ?? value.start, end: end ?? value.end, bound: "upper" };
};

/** 二つの値のあいだが範囲の語だけか（まわりの空白は許す）。 */
const MAX_GAP = 2;

const joined = (source: string, left: Marked, right: Marked, joiners: readonly string[]): boolean => {
  const between = source.slice(left.age.end, right.age.start);
  const trimmed = folded(between.trim());
  return between.length - trimmed.length <= MAX_GAP && joiners.some((joiner) => folded(joiner) === trimmed);
};

/** 範囲の上の端の値。下の端は lower。下の端が上の端より大きければ範囲と読まない。 */
const rangeOf = ({ age: lower }: Marked, { age: upper }: Marked): FactValue | undefined => {
  if (Number(lower.key) > Number(upper.key)) return undefined;
  return { start: lower.start, end: upper.end, kind: "quantity", key: upper.key, unit: "", lower: lower.key, bound: "upper" };
};

type Reading = { readonly ages: FactValue[]; readonly skip: boolean };

const readAges = (source: string, values: readonly FactValue[], words: AgeWords): FactValue[] => {
  const after = at(words.marks, "after");
  const candidates = values.filter((value) => mayBeAge(source, value, after)).map((value) => markedAge(source, value, words));
  return candidates.reduce<Reading>(
    ({ ages, skip }, left, index) => {
      if (skip) return { ages, skip: false };
      const right = candidates[index + 1];
      const range = right !== undefined && (left.marked || right.marked) && joined(source, left, right, words.joiners) ? rangeOf(left, right) : undefined;
      if (range !== undefined) return { ages: [...ages, withLimit(source, range, words)], skip: true };
      return { ages: left.marked ? [...ages, withLimit(source, left.age, words)] : ages, skip: false };
    },
    { ages: [], skip: false },
  ).ages;
};

/** 年齢の印の付いた数と、印の付いた年齢を片方に持つ範囲を、印の語まで含む年齢の値にして返す。文書の中の順。 */
export const ageValues = (source: string, values: readonly FactValue[], words: AgeWords): FactValue[] =>
  readAges(
    source,
    values.toSorted((left, right) => left.start - right.start),
    words,
  );
