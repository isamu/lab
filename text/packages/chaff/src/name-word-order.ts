import { escapeRegExp } from "./orthography.ts";

// 語の順を入れ替えて書いた同じ名前（統計学基礎 と 基礎統計学、Foundations of Statistics と Statistical Foundations）。
// 名前と読める所（括弧や引用符の中、大文字で始まる語の並び、名前を書く欄の後ろ）だけを比べ、同じ語（日本語は形態素、英語は語幹）を
// 違う順に並べた二つのうち、少ないほうを指す。片方がもう片方を含む名前（統計学 と 統計学基礎）は別の名前として比べない。
// 大文字の語の並びだけでは名前と言い切れない（Florida Supreme Court と Supreme Court of Florida はふつうの言い換え）ので、
// 二つのどちらかが、括弧の中か欄の後ろか表の升まるごとに書いた名前（anchored）のときだけ比べる。

/**
 * anchored は、括弧の中、欄の後ろ、表の升まるごとのように、名前として書いたと分かる所。clipped は欄の後ろのように、名前の後ろに
 * 文が続きうる所で、名前は最初の名前の外の語（を、in）の手前まで。
 */
export type NameSpan = { readonly start: number; readonly end: number; readonly anchored?: boolean; readonly clipped?: boolean };

/** 名前の中の内容語。key は比べるための形（英語は語幹）。 */
export type OrderWord = { readonly start: number; readonly end: number; readonly key: string };

export type OrderName = { readonly offset: number; readonly surface: string; readonly keys: readonly string[]; readonly anchored: boolean };

export type OrderVariant = { readonly name: OrderName; readonly usual: string };

/** 名前と読む長さの上限（字）。これより長い括弧の中は、名前ではなく引用した文。 */
export const MAX_NAME_LENGTH = 80;

/** 名前の中に来ない文の区切り。 */
const CLAUSE_MARKS = "\\n。、．，.,;；:：!！?？";

/** 括弧や引用符の組（「」、“”）の中身。開きと閉じの二字で一つの組。 */
export const quotedSpans = (text: string, pairs: readonly string[]): NameSpan[] =>
  pairs.flatMap((pair) => {
    const [open = "", close = ""] = [...pair];
    if (open === "" || close === "") return [];
    const body = `[^${escapeRegExp(open)}${escapeRegExp(close)}${CLAUSE_MARKS}]{1,${String(MAX_NAME_LENGTH)}}`;
    return [...text.matchAll(new RegExp(`${escapeRegExp(open)}(${body})${escapeRegExp(close)}`, "gu"))].map((found) => {
      const start = (found.index ?? 0) + open.length;
      return { start, end: start + (found[1] ?? "").length, anchored: true };
    });
  });

const CAPITALISED = "\\p{Lu}[\\p{L}'’-]*";

const FIRST_WORD = new RegExp(`^${CAPITALISED}[ \\t]+`, "u");

/**
 * 大文字で始まる語が二つ以上並んだ所（Foundations of Statistics）。語のあいだに小さな語（of）を挟んでよい。文の頭の語は、
 * 文の頭だから大文字のことがあるので、外す（Take Data Lab の Take）。
 */
export const titleCaseSpans = (text: string, joiners: readonly string[], isSentenceStart: (offset: number) => boolean = () => false): NameSpan[] => {
  const joiner = joiners.length === 0 ? "" : `(?:(?:${joiners.map(escapeRegExp).join("|")})[ \\t]+)*`;
  const pattern = new RegExp(`(?<![\\p{L}'’-])${CAPITALISED}(?:[ \\t]+${joiner}${CAPITALISED})+`, "gu");
  return [...text.matchAll(pattern)].map((found) => {
    const start = found.index ?? 0;
    const lead = isSentenceStart(start) ? (FIRST_WORD.exec(found[0])?.[0].length ?? 0) : 0;
    return { start: start + lead, end: start + found[0].length };
  });
};

/** 名前を書く欄の語（前提科目：、Course:）の後ろの、句読点か行の終わりまで。 */
export const labelledSpans = (text: string, labels: readonly string[]): NameSpan[] => {
  if (labels.length === 0) return [];
  const label = labels.map(escapeRegExp).join("|");
  const pattern = new RegExp(`(?<![\\p{L}])(?:${label})[ \\t]*[:：][ \\t]*([^${CLAUSE_MARKS}]{1,${String(MAX_NAME_LENGTH)}})`, "giu");
  return [...text.matchAll(pattern)].map((found) => {
    const value = (found[1] ?? "").trimEnd();
    const start = (found.index ?? 0) + found[0].length - (found[1] ?? "").length;
    return { start, end: start + value.length, anchored: true, clipped: true };
  });
};

/** 語の比べる形: 小文字にして、語尾の語（ical、ics、s）を一つ、長いほうから外す。語幹が短くなりすぎる語尾は外さない。 */
const MIN_STEM = 4;

export const stemOf = (word: string, suffixes: readonly string[]): string => {
  const lower = word.toLowerCase();
  const suffix = suffixes
    .toSorted((left, right) => right.length - left.length)
    .find((candidate) => lower.endsWith(candidate.toLowerCase()) && lower.length - candidate.length >= MIN_STEM);
  return suffix === undefined ? lower : lower.slice(0, lower.length - suffix.length);
};

/** clipped の範囲の終わり: 範囲の中で、内容語の後に来る最初の名前の外の語（stops の位置）の手前。 */
const clippedEnd = (span: NameSpan, words: readonly OrderWord[], stops: readonly number[]): number => {
  if (span.clipped !== true) return span.end;
  const firstWord = words.find((word) => word.start >= span.start && word.end <= span.end);
  if (firstWord === undefined) return span.end;
  return stops.find((stop) => stop > firstWord.start && stop < span.end) ?? span.end;
};

/** 名前が、もっと長い名前の一部か（“West Indies Hurricanes and other Tropical Cyclones” の West Indies Hurricanes）。 */
const isPartOf = (name: OrderName, longer: OrderName): boolean =>
  name.offset >= longer.offset && name.offset + name.surface.length <= longer.offset + longer.surface.length;

/** 範囲の中の内容語の形。同じ所の同じ名前は一つにまとめ、どれかが anchored ならその名前は anchored。
 * anchored の名前の一部だけを大文字の語の並びとして読んだものは除く。 */
export const orderNamesOf = (text: string, spans: readonly NameSpan[], words: readonly OrderWord[], stops: readonly number[] = []): OrderName[] => {
  const named = spans.flatMap((span): OrderName[] => {
    const end = clippedEnd(span, words, stops);
    const inside = words.filter((word) => word.start >= span.start && word.end <= end);
    const first = inside[0];
    const last = inside.at(-1);
    if (first === undefined || last === undefined) return [];
    return [{ offset: first.start, surface: text.slice(first.start, last.end), keys: inside.map((word) => word.key), anchored: span.anchored === true }];
  });
  const byPlace = named.reduce<Map<string, OrderName>>((places, name) => {
    const id = `${String(name.offset)}:${name.surface}`;
    const known = places.get(id);
    return places.set(id, known === undefined ? name : { ...known, anchored: known.anchored || name.anchored });
  }, new Map());
  const names = [...byPlace.values()];
  return names
    .filter((name) => name.anchored || !names.some((other) => other.anchored && isPartOf(name, other)))
    .toSorted((left, right) => left.offset - right.offset);
};

type Tally = { readonly first: OrderName; readonly count: number; readonly anchored: boolean };

const talliesOf = (names: readonly OrderName[]): Tally[] => [
  ...names
    .reduce<Map<string, Tally>>((tallies, name) => {
      const known = tallies.get(name.surface);
      return tallies.set(name.surface, { first: known?.first ?? name, count: (known?.count ?? 0) + 1, anchored: (known?.anchored ?? false) || name.anchored });
    }, new Map())
    .values(),
];

/** 多いほうが前。同じ数なら先に書いたほうが前。 */
const byUse = (left: Tally, right: Tally): number => right.count - left.count || left.first.offset - right.first.offset;

const bagOf = (keys: readonly string[]): string => keys.toSorted().join("\u0000");

/** 同じ語を違う順に並べた別の書き方で、どちらも他方を含まないか。 */
export const isReordered = (left: OrderName, right: OrderName): boolean =>
  left.keys.join("\u0000") !== right.keys.join("\u0000") &&
  bagOf(left.keys) === bagOf(right.keys) &&
  !left.surface.includes(right.surface) &&
  !right.surface.includes(left.surface);

/**
 * 多く使った書き方と同じ語を違う順に並べた名前。少ないほうを一つずつ指す。二つのどちらかが名前として書いた所（anchored）に
 * あるときだけ。surfaces は表の升まるごとの書き方で、その書き方の名前も anchored と見る。
 */
export const wordOrderVariants = (names: readonly OrderName[], surfaces: ReadonlySet<string> = new Set()): OrderVariant[] => {
  const tallies = talliesOf(names).toSorted(byUse);
  const anchored = (tally: Tally): boolean => tally.anchored || surfaces.has(tally.first.surface);
  return tallies.flatMap((tally, index) => {
    const usual = tallies.slice(0, index).find((other) => (anchored(other) || anchored(tally)) && isReordered(other.first, tally.first));
    return usual === undefined ? [] : [{ name: tally.first, usual: usual.first.surface }];
  });
};
