import { isNearWord, nameKey, type NameMention } from "./name-variants.ts";
import type { Cell } from "./facts/table-facts.ts";
import { withoutEdgeMarks } from "./facts/trim-marks.ts";

// 表の升に書いた名前と、本文の名前の書き分け（本文は Sofia Mendes、担当者の表は Sofia Mendez）。表の升は品詞解析を通らないので、
// 名前の形をした升だけを読み、本文で読めた名前と比べる。比べるのは姓と名のように二語以上の名前で、一語だけが違うときに限る。
// 同じ語がほかにあることが、同じ人を指す手がかりになる。漢字・かなの名前は記号・幅の違いだけを見る（読みが分からない）。

/** 表の升の名前。words は空白で分けた語。 */
export type CellName = { readonly surface: string; readonly offset: number; readonly words: readonly string[] };

/** 本文の名前の書き方と、その数。 */
export type ProseName = { readonly surface: string; readonly words: readonly string[]; readonly count: number };

export type CellNameVariant = { readonly name: CellName; readonly usual: string; readonly kind: "spelling" | "near" };

/** 英字の名前の升: 大文字で始まる語が二つから四つ。小文字の語（Write the procedure）を含む升は名前でない。 */
const LATIN_NAME = /^\p{Lu}[\p{L}'’.-]*(?: \p{Lu}[\p{L}'’.-]*){1,3}$/u;
/** 漢字・カタカナの名前の升: 名前の字の語が、空白一つを挟んで二つか三つ（佐々木 美穂）。 */
const CJK_NAME = /^[\p{Script=Han}\p{Script=Katakana}ー々]+(?:[ \u3000][\p{Script=Han}\p{Script=Katakana}ー々]+){1,2}$/u;
const SPACE = /[ \u3000]/u;
const LOWER = /\p{Ll}/u;

/** 名前の形をした升。升の字の前後の空白と強調の印は名前の外。 */
export const cellNamesIn = (cells: readonly Cell[]): CellName[] =>
  cells.flatMap((cell) => {
    const surface = withoutEdgeMarks(cell.text.trim());
    if (!(LATIN_NAME.test(surface) && LOWER.test(surface)) && !CJK_NAME.test(surface)) return [];
    return [{ surface, offset: cell.start + cell.text.indexOf(surface), words: surface.split(SPACE) }];
  });

/**
 * 本文の名前の書き方ごとの数。空白一つで並んだ名前の現れ（佐々木 と 美穂）は、一つの名前（佐々木 美穂）としても数える。
 * 日本語の解析器は姓と名のあいだの空白で名前を切る。
 */
export const proseNamesOf = (mentions: readonly NameMention[], source: string): ProseName[] => {
  const sorted = mentions.toSorted((left, right) => left.offset - right.offset);
  const joined = sorted.flatMap((mention, index) => {
    const next = sorted[index + 1];
    const end = mention.offset + mention.surface.length;
    return next !== undefined && next.offset === end + 1 && SPACE.test(source.charAt(end)) ? [`${mention.surface}${source.charAt(end)}${next.surface}`] : [];
  });
  const counts = new Map<string, number>();
  [...sorted.map((mention) => mention.surface), ...joined].forEach((surface) => counts.set(surface, (counts.get(surface) ?? 0) + 1));
  return [...counts].map(([surface, count]) => ({ surface, words: surface.split(SPACE), count }));
};

const LATIN = /\p{Script=Latin}/u;
/** 英字の語の中の記号（O'Connor、Anne-Marie）。一字違いは字だけで見る。 */
const WORD_MARKS = /['’.-]/gu;

/**
 * 二つの英字の語が一字違いか（名前の見方と同じ isNearWord）。漢字・かなの語は見ない。升は読みが分からず、一字違いの名前
 * （佐藤 太郎 と 佐藤 次郎）は別の人のことが多い。
 */
const isNearNameWord = (left: string, right: string): boolean =>
  LATIN.test(left) && LATIN.test(right) && isNearWord(left.toLowerCase().replaceAll(WORD_MARKS, ""), right.toLowerCase().replaceAll(WORD_MARKS, ""));

/**
 * 升の名前が、本文の名前の書き分けか。記号・幅・大小だけの違いか、語の数が同じで英字の一語だけが一字違い、残りの語が同じとき。
 * 一字違いは、本文の形が二度以上、升の形が文書の中で一度だけのとき（別の人のこともある）。
 */
export const cellNameRelation = (name: CellName, uses: number, prose: ProseName): CellNameVariant["kind"] | undefined => {
  if (name.surface === prose.surface || name.words.length !== prose.words.length) return undefined;
  if (nameKey(name.surface) === nameKey(prose.surface)) return "spelling";
  const differ = name.words.flatMap((word, index) => (word === prose.words[index] ? [] : [index]));
  const [at] = differ;
  if (differ.length !== 1 || at === undefined || uses !== 1 || prose.count < 2) return undefined;
  return isNearNameWord(name.words[at] ?? "", prose.words[at] ?? "") ? "near" : undefined;
};

/** 記号・幅・大小だけの違いを、一字違いより先に取る。 */
const KIND_ORDER: readonly CellNameVariant["kind"][] = ["spelling", "near"];

/**
 * 表の升の名前のうち、本文の名前の書き分けのもの。記号だけの違いを先に、その中で本文の形のうち一番多いものと比べる。
 * 書き方ごとに最初の升を一つ。
 */
export const cellNameVariants = (names: readonly CellName[], prose: readonly ProseName[]): CellNameVariant[] => {
  const uses = new Map(prose.map((form) => [form.surface, form.count]));
  const firsts = new Map<string, CellName>();
  names.forEach((name) => {
    uses.set(name.surface, (uses.get(name.surface) ?? 0) + 1);
    if (!firsts.has(name.surface)) firsts.set(name.surface, name);
  });
  return [...firsts.values()].flatMap((name) => {
    const [usual] = prose
      .flatMap((form) => {
        const kind = cellNameRelation(name, uses.get(name.surface) ?? 0, form);
        return kind === undefined ? [] : [{ form, kind }];
      })
      .toSorted((left, right) => KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) || right.form.count - left.form.count);
    return usual === undefined ? [] : [{ name, usual: usual.form.surface, kind: usual.kind }];
  });
};
