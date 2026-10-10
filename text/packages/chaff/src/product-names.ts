import { escapeRegExp } from "./orthography.ts";

// 製品の名前を、文書の中で二通りに書いた所（ミナモール錠 と ミナモル錠）。製品の名前は、製品の形を言う語（錠、カプセル、クリーム）の
// すぐ前の、カタカナの連なり。形の語は語彙表 product-form が言い、group が同じ語は同じ形の別の書き方。作った製品の名前は解析器が
// 固有名詞と読まず、読みも名前の字のとおりにずれるので、人や会社の名前の見方では比べられない。

export type ProductForm = { readonly pattern: string; readonly group: string };

/** surface は形の語も含めた書いたまま。base はカタカナの名前の部分、form は形の語の組。 */
export type ProductMention = { readonly surface: string; readonly offset: number; readonly base: string; readonly form: string };

export type ProductVariant = { readonly mention: ProductMention; readonly usual: string; readonly kind: "near" };

const KATAKANA = /[\p{Script=Katakana}ー]/u;
/** 形の語の後ろに続くと、長い語の一部になる字（錠剤、液晶、ゲルマニウム、スプレー缶）。 */
const WORD_CONTINUES = /[\p{Script=Han}\p{Script=Katakana}ー]/u;
/** 名前の部分の字の数の下限。短いカタカナ（ケア、ハーブ）は製品の名前でなく、ふつうの語のことが多い。 */
const MIN_NAME_CHARS = 4;
/** 名前を探す、形の語の前の範囲（UTF-16 の単位）。 */
const LOOKBACK = 30;
const LONG_VOWEL = "ー";

/** at のすぐ前の、カタカナの連なり。 */
const katakanaBefore = (source: string, at: number): string => {
  const chars = Array.from(source.slice(Math.max(0, at - LOOKBACK), at));
  return chars.slice(chars.findLastIndex((char) => !KATAKANA.test(char)) + 1).join("");
};

const mentionAt = (source: string, form: ProductForm, at: number): ProductMention | undefined => {
  const end = at + form.pattern.length;
  if (WORD_CONTINUES.test(source.charAt(end))) return undefined;
  const base = katakanaBefore(source, at);
  if (Array.from(base).length < MIN_NAME_CHARS) return undefined;
  return { surface: source.slice(at - base.length, end), offset: at - base.length, base, form: form.group };
};

/** 文書の中の製品の名前の現れ。同じ所で終わる形の語は長いほうを取る（顆粒 と 粒）。 */
export const productMentionsIn = (source: string, forms: readonly ProductForm[]): ProductMention[] => {
  const ends = new Set<number>();
  return forms
    .toSorted((left, right) => right.pattern.length - left.pattern.length)
    .flatMap((form) =>
      [...source.matchAll(new RegExp(escapeRegExp(form.pattern), "gu"))].flatMap((match) => {
        const end = match.index + form.pattern.length;
        if (ends.has(end)) return [];
        const mention = mentionAt(source, form, match.index);
        if (mention !== undefined) ends.add(end);
        return mention === undefined ? [] : [mention];
      }),
    )
    .toSorted((left, right) => left.offset - right.offset);
};

/** 同じ長さで、一字だけ違う（ミナモール と ミナモオル）。 */
const isOneReplaced = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.filter((char, index) => char !== right[index]).length === 1;

/** longer から長音の記号を一つ抜くと shorter になる（ミナモール と ミナモル）。 */
const dropsOneLongVowel = (longer: readonly string[], shorter: readonly string[]): boolean =>
  longer.length === shorter.length + 1 && longer.some((char, index) => char === LONG_VOWEL && longer.toSpliced(index, 1).join("") === shorter.join(""));

/** 二つのカタカナの名前が、一字の置き換えか、長音の記号一つの有る無しだけ違う。 */
export const isKanaSlip = (left: string, right: string): boolean => {
  const [leftChars, rightChars] = [Array.from(left), Array.from(right)];
  return isOneReplaced(leftChars, rightChars) || dropsOneLongVowel(leftChars, rightChars) || dropsOneLongVowel(rightChars, leftChars);
};

type Counted = { readonly mention: ProductMention; readonly count: number };

/**
 * slip が usual の書き損じと言えるか。形の語の組が同じで、名前の部分が一字違いか長音の有る無しで、slip が一度だけ、usual が二度以上。
 * 一字違いの別の製品もあるので、何度も書いた名前と一度だけの名前の組に限る。
 */
export const isProductSlip = (slip: Counted, usual: Counted): boolean =>
  slip.count === 1 && usual.count >= 2 && slip.mention.form === usual.mention.form && isKanaSlip(slip.mention.base, usual.mention.base);

/** 名前と形の語の組ごとに数える。同じ組の別の書き方（錠 と 錠剤）は同じ製品の現れ。 */
const talliesOf = (mentions: readonly ProductMention[]): Counted[] => {
  const tallies = new Map<string, Counted>();
  mentions.forEach((mention) => {
    const key = `${mention.base}\u0000${mention.form}`;
    const tally = tallies.get(key);
    tallies.set(key, { mention: tally?.mention ?? mention, count: (tally?.count ?? 0) + 1 });
  });
  return [...tallies.values()];
};

/** 多いほうが先。同数なら先に書いたほう。 */
const byUsage = (left: Counted, right: Counted): number => right.count - left.count || left.mention.offset - right.mention.offset;

/** 製品の名前の、一度だけ書いた書き損じ。相手のうち一番多いものと比べる。 */
export const productVariants = (mentions: readonly ProductMention[]): ProductVariant[] => {
  const tallies = talliesOf(mentions);
  return tallies.flatMap((tally): ProductVariant[] => {
    const [usual] = tallies.filter((other) => isProductSlip(tally, other)).toSorted(byUsage);
    return usual === undefined ? [] : [{ mention: tally.mention, usual: usual.mention.surface, kind: "near" }];
  });
};
