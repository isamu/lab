import { isNearWord, nameKey } from "./name-variants.ts";
import { escapeRegExp } from "./orthography.ts";
import { toKatakana } from "./kana-spelling.ts";

// 場所の名前を、文書の中で二通りに書いた所（八重洲中央口 と 八重州中央口、11th Street と 11th St.、King's Cross と Kings Cross）。
// 場所の名前は、場所を言う語（口、駅、センター、Street、Station）で終わる名前。場所の語は語彙表 place-word が言い、group が同じ語は
// 同じ語の別の書き方（Street と St.、Center と Centre）。名前の部分は、場所の語のすぐ前の、名前に使う字の連なり。

type Span = { readonly start: number; readonly end: number };

export type PlaceWord = { readonly pattern: string; readonly group: string };

/**
 * surface は場所の語も含めた書いたまま。base は名前の部分、place は場所の語の組。reading は名前の部分の読み（読めなければ無い）。properAt は
 * base の字のうち、品詞解析が固有名詞と読んだ語に入る字の位置（八重洲中央口 の 八・重・洲）。
 */
export type PlaceMention = {
  readonly surface: string;
  readonly offset: number;
  readonly base: string;
  readonly place: string;
  readonly reading?: string | undefined;
  readonly properAt: readonly number[];
};

/**
 * 名前の現れの読み方。properWords は範囲に掛かる、品詞解析が固有名詞と読んだ語の範囲、isFunctionWord は名前の頭に立たない語（The、At）、readingOf は範囲の読み、joiners は
 * 英字の名前の中に立つ小さい語（of）。
 */
export type PlaceReader = {
  readonly properWords: (start: number, end: number) => readonly Span[];
  readonly joiners: ReadonlySet<string>;
  readonly isFunctionWord: (start: number, end: number) => boolean;
  readonly readingOf: (start: number, end: number) => string | undefined;
};

/** spelling は記号・幅・大小だけ、place-word は場所の語の書き方、reading は読みが同じ、near は名前の一字違い。 */
export type PlaceRelation = "spelling" | "place-word" | "reading" | "near";

export type PlaceVariant = { readonly mention: PlaceMention; readonly usual: string; readonly kind: PlaceRelation };

const LATIN = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;
/** 漢字・カタカナの名前に使う字。ひらがなは名前の外（の、で、にて）。 */
const CJK_NAME = /[\p{Script=Katakana}\p{Script=Han}\p{Script=Latin}\p{N}ー・々]/u;
const HIRAGANA = /\p{Script=Hiragana}/u;
const JOINER = "・";
/** かなだけの名前の前に立つもの。空白、行の頭、開き括弧。読点のあと（、この口）は文の続き。 */
const KANA_NAME_OPENS = /^$|[\s（「『【([]/u;
/** 英字の名前の一語。大文字で始まる語か、序数（11th）。 */
const LATIN_NAME_WORD = /^(?:\p{Lu}[\p{L}'’&-]*|\d+(?:st|nd|rd|th))$/u;

/** 場所の語が語の終わりに立つか。続く字が名前の字なら、長い語の一部（口座、Streetcar）。 */
const endsWord = (source: string, end: number, latin: boolean): boolean => {
  const next = source.charAt(end);
  return latin ? !LETTER.test(next) : !CJK_NAME.test(next) || next === JOINER;
};

/** 名前を探す、場所の語の前の範囲（UTF-16 の単位）。 */
const LOOKBACK = 40;

/** end のすぐ前の、char の字の連なりの始まり。 */
const runStart = (source: string, end: number, char: RegExp): number => {
  const chars = Array.from(source.slice(Math.max(0, end - LOOKBACK), end));
  return end - chars.slice(chars.findLastIndex((letter) => !char.test(letter)) + 1).join("").length;
};

/**
 * 漢字・カタカナの名前: 場所の語の前の、名前に使う字の連なり。それが無く、空白や開き括弧のあとにひらがなだけが続くなら、かなで書いた
 * 名前（博多駅 ちくし口）。語のあとのひらがな（東京駅の北口 の の）は名前の外。
 */
const cjkBaseBefore = (source: string, end: number): Span | undefined => {
  const start = runStart(source, end, CJK_NAME);
  const kanaStart = start === end ? runStart(source, end, HIRAGANA) : start;
  const from = kanaStart < start && !KANA_NAME_OPENS.test(source.charAt(kanaStart - 1)) ? start : kanaStart;
  const trimmed = source.startsWith(JOINER, from) ? from + 1 : from;
  return trimmed < end ? { start: trimmed, end } : undefined;
};

/** 英字の名前の一語の前に、空白一つで続く語。 */
const wordBefore = (source: string, at: number): Span | undefined => {
  if (source.charAt(at - 1) !== " ") return undefined;
  const from = Math.max(0, at - 1 - LOOKBACK);
  const text = source.slice(from, at - 1);
  const parts = text.split(/\s/u);
  const word = parts.at(-1) ?? "";
  if (word === "" || (from > 0 && parts.length === 1)) return undefined;
  const start = from + text.length - word.length;
  return { start, end: start + word.length };
};

/** 名前の前の、大文字で始まる短い略語（St. George Street の St.）。名前はそこから続くので、どこからが名前か分からない。 */
const LEADING_ABBREVIATION = /^\p{Lu}\p{L}{0,2}\.$/u;

/**
 * 英字の名前: 場所の語の前の、空白一つでつながる大文字の語か序数の続き。名前の中の小さい語（University of Tokyo の of）は語彙表
 * place-name-joiner が言う。頭の機能語（The、At）は外す。前に略語（St.）が立てば、名前の始まりが分からないので読まない。
 */
const latinBaseBefore = (source: string, end: number, reader: PlaceReader): Span | undefined => {
  const words: Span[] = [];
  const isNameWord = (span: Span | undefined): span is Span => span !== undefined && LATIN_NAME_WORD.test(source.slice(span.start, span.end));
  const step = (at: number): Span | undefined => {
    const word = wordBefore(source, at);
    if (word === undefined) return undefined;
    const joined = reader.joiners.has(source.slice(word.start, word.end)) && isNameWord(wordBefore(source, word.start));
    if (!isNameWord(word) && !joined) return word;
    words.unshift(word);
    return step(word.start);
  };
  const stopper = step(end);
  if (stopper !== undefined && LEADING_ABBREVIATION.test(source.slice(stopper.start, stopper.end))) return undefined;
  const name = words.slice(
    Math.max(
      0,
      words.findIndex((word) => !reader.isFunctionWord(word.start, word.end)),
    ),
  );
  const [first, last] = [name[0], name.at(-1)];
  return first === undefined || last === undefined || reader.isFunctionWord(first.start, first.end) ? undefined : { start: first.start, end: last.end };
};

/**
 * base の字のうち、名前の部分の中で閉じる固有名詞の語に入る字の位置。場所の語まで続く固有名詞（北口、日比谷公園）は、名前でなく
 * 出口や施設の呼び名として読まれたものなので数えない。
 */
const properIndexes = (source: string, base: Span, properWords: readonly Span[]): number[] => {
  const inside = properWords.filter((word) => word.end <= base.end);
  return Array.from(source.slice(base.start, base.end)).flatMap((_char, index, chars) => {
    const at = base.start + chars.slice(0, index).join("").length;
    return inside.some((word) => word.start <= at && at < word.end) ? [index] : [];
  });
};

const mentionAt = (source: string, word: PlaceWord, at: number, reader: PlaceReader): PlaceMention | undefined => {
  const latin = LATIN.test(word.pattern);
  const end = at + word.pattern.length;
  if (!endsWord(source, end, latin) || (latin && LETTER.test(source.charAt(at - 1)))) return undefined;
  const base = latin ? latinBaseBefore(source, at, reader) : cjkBaseBefore(source, at);
  if (base === undefined) return undefined;
  return {
    surface: source.slice(base.start, end),
    offset: base.start,
    base: source.slice(base.start, latin ? at - 1 : at),
    place: word.group,
    reading: latin ? undefined : reader.readingOf(base.start, at),
    properAt: latin ? [] : properIndexes(source, base, reader.properWords(base.start, end)),
  };
};

/** 文書の中の場所の名前の現れ。同じ所で終わる場所の語は長いほうを取る（中央口 と 口）。 */
export const placeMentionsIn = (source: string, words: readonly PlaceWord[], reader: PlaceReader): PlaceMention[] => {
  const ends = new Set<number>();
  return words
    .toSorted((left, right) => right.pattern.length - left.pattern.length)
    .flatMap((word) =>
      [...source.matchAll(new RegExp(escapeRegExp(word.pattern), "gu"))].flatMap((match) => {
        const end = match.index + word.pattern.length;
        if (ends.has(end)) return [];
        const mention = mentionAt(source, word, match.index, reader);
        if (mention !== undefined) ends.add(end);
        return mention === undefined ? [] : [mention];
      }),
    )
    .toSorted((left, right) => left.offset - right.offset);
};

const DIGIT = /\p{N}/u;
const HAN = /^\p{Script=Han}$/u;

/**
 * 名前の字について語彙表が言うこと。directions は方角や位置の字（東、上、新）で、それだけが違う名前は別の所（下北沢 と 上北沢）。
 * sameReading は読みの同じ字から組の代表へ（洲 と 州）。
 */
export type PlaceChars = { readonly directions: ReadonlySet<string>; readonly sameReading: ReadonlyMap<string, string> };

const NO_PLACE_CHARS: PlaceChars = { directions: new Set(), sameReading: new Map() };

type CharDifference = { readonly at: number; readonly slip: string; readonly usual: string };

/** 漢字・かなの名前の部分が、字数が同じで一字だけ違うときの、その字。 */
const oneCharDifference = (slip: PlaceMention, usual: PlaceMention): CharDifference | undefined => {
  const [slipChars, usualChars] = [[...slip.base], [...usual.base]];
  if (slipChars.length !== usualChars.length) return undefined;
  const differ = usualChars.flatMap((char, index) => (char === slipChars[index] ? [] : [index]));
  const [at] = differ;
  return differ.length === 1 && at !== undefined ? { at, slip: slipChars[at] ?? "", usual: usualChars[at] ?? "" } : undefined;
};

const isDirectionDifference = (difference: CharDifference | undefined, chars: PlaceChars): boolean =>
  difference !== undefined && (chars.directions.has(difference.slip) || chars.directions.has(difference.usual));

/** 漢字どうしの一字違いは、読みの同じ字の組のときだけ（八重洲 と 八重州）。読みの違う字（戸塚 と 戸山）は別の所のことが多い。 */
const isReadAlike = (difference: CharDifference, chars: PlaceChars): boolean => {
  if (!HAN.test(difference.slip) || !HAN.test(difference.usual)) return true;
  const group = chars.sameReading.get(difference.slip);
  return group !== undefined && group === chars.sameReading.get(difference.usual);
};

/** 漢字・かなの名前の部分が一字だけ違い、その字が、多いほうで固有名詞の語に入る（八重洲 と 八重州）。数字は別の所。 */
const isCjkSlip = (slip: PlaceMention, usual: PlaceMention, chars: PlaceChars): boolean => {
  const difference = oneCharDifference(slip, usual);
  return (
    difference !== undefined &&
    usual.properAt.includes(difference.at) &&
    !DIGIT.test(difference.usual) &&
    !DIGIT.test(difference.slip) &&
    isReadAlike(difference, chars)
  );
};

const latinWords = (base: string): string[] =>
  base
    .toLowerCase()
    .replaceAll(/['’]/gu, "")
    .split(/[\s-]+/u);

/** 英字の名前の部分が、一語だけ一字違い（Union と Unoin）。 */
const isLatinSlip = (slip: PlaceMention, usual: PlaceMention): boolean => {
  const [slipWords, usualWords] = [latinWords(slip.base), latinWords(usual.base)];
  const differ = usualWords.flatMap((word, index) => (word === slipWords[index] ? [] : [index]));
  const [at] = differ;
  return slipWords.length === usualWords.length && differ.length === 1 && at !== undefined && isNearWord(slipWords[at] ?? "", usualWords[at] ?? "");
};

const HIRAGANA_ONLY = /^\p{Script=Hiragana}+$/u;

/**
 * ひらがなで書いた名前（ちくし）が、漢字で書いた名前（筑紫）の読みと同じか、一字だけ違う。解析器は地名の読みを一通りしか持たず
 * （筑紫 を ツクシ と読む）、かなで書いた読み（チクシ）と一字ずれることがある。
 */
const isKanaSpellingOf = (slip: PlaceMention, usual: PlaceMention): boolean => {
  if (!HIRAGANA_ONLY.test(slip.base) || usual.reading === undefined || HIRAGANA_ONLY.test(usual.base)) return false;
  const [kana, reading] = [[...toKatakana(slip.base)], [...usual.reading]];
  return kana.length === reading.length && kana.filter((char, index) => char !== reading[index]).length <= 1;
};

/** 一度だけ書いた形と、二度以上書いた形。読みの同じ別の所や一字違いの別の所もあるので、書き損じと見るのはこのときだけ。 */
type Counted = { readonly mention: PlaceMention; readonly count: number };

const isSlipOf = (slip: Counted, usual: Counted): boolean => slip.count === 1 && usual.count >= 2;

/**
 * 二つの書き方が、同じ所を二通りに書いたものか。場所の語の組が同じで、名前と語の全体が記号・幅・大小だけ違うか、場所の語の
 * 書き方だけが違う（11th St. と 11th Street）か。名前の部分の読みが同じか、かなで書いた読み（筑紫口 と ちくし口）か、一字違い
 * （八重洲 と 八重州）なのは、少ないほうが一度だけ、多いほうが二度以上のときに限る。違う一字が方角や位置の字なら別の所。
 */
export const placeRelation = (slip: Counted, usual: Counted, chars: PlaceChars = NO_PLACE_CHARS): PlaceRelation | undefined => {
  const [left, right] = [slip.mention, usual.mention];
  if (left.surface === right.surface || left.place !== right.place) return undefined;
  if (nameKey(left.surface) === nameKey(right.surface)) return "spelling";
  if (nameKey(left.base) === nameKey(right.base)) return "place-word";
  if (!isSlipOf(slip, usual) || isDirectionDifference(oneCharDifference(left, right), chars)) return undefined;
  if ((left.reading !== undefined && left.reading === right.reading) || isKanaSpellingOf(left, right)) return "reading";
  const latin = LATIN.test(left.base) && LATIN.test(right.base);
  const slipped = latin ? isLatinSlip(left, right) : isCjkSlip(left, right, chars);
  return slipped ? "near" : undefined;
};

const talliesOf = (mentions: readonly PlaceMention[]): Counted[] => {
  const tallies = new Map<string, Counted>();
  mentions.forEach((mention) => {
    const tally = tallies.get(mention.surface);
    tallies.set(mention.surface, { mention: tally?.mention ?? mention, count: (tally?.count ?? 0) + 1 });
  });
  return [...tallies.values()];
};

/** 多いほうが先。同数なら先に書いたほう。 */
const byUsage = (left: Counted, right: Counted): number => right.count - left.count || left.mention.offset - right.mention.offset;

/** 同じ所の、少ないほうの書き方。同じ所と言える相手のうち一番多いものと比べる。書き方ごとに最初の現れを一つ。 */
export const placeVariants = (mentions: readonly PlaceMention[], chars: PlaceChars = NO_PLACE_CHARS): PlaceVariant[] => {
  const tallies = talliesOf(mentions);
  return tallies.flatMap((tally) => {
    const [usual] = tallies.filter((other) => other !== tally && placeRelation(tally, other, chars) !== undefined).toSorted(byUsage);
    if (usual === undefined || byUsage(usual, tally) > 0) return [];
    const kind = placeRelation(tally, usual, chars);
    return kind === undefined ? [] : [{ mention: tally.mention, usual: usual.mention.surface, kind }];
  });
};
