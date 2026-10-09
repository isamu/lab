import { linesOf, type Line } from "../structure/lines.ts";
import { sameMeasure, sameUnit, type Measured } from "./measures.ts";
import { cellsOf, tablesOf, type Cell } from "./table-facts.ts";
import { withoutEdgeMarks } from "./trim-marks.ts";
import { toleranceOf } from "./unit-tolerance.ts";

/**
 * 表に量を書いた品物（材料の表の「しょうゆ｜大さじ1」）を、本文で違う単位の量と一緒に書いた所（しょうゆ30ml、30 ml of soy sauce）。
 * 表の量は、行の最初の量（人数ごとの列があれば、手順が従う最初の列）。本文の量が表の量より多いときだけ言う。本文の名前は、量のすぐ前（空白一つまで）か、つなぐ語（の、of）と
 * 冠詞（the）を挟んで量の後ろ。名前は語の切れ目で始まり終わる（「濃口しょうゆ」の しょうゆ は切れ目で始まるが、「強力粉」の 力粉 は始まらない）。
 */
export type ItemConflict = { readonly name: string; readonly measured: Measured; readonly other: Measured };

export type ItemWords = { readonly links: readonly string[]; readonly determiners: readonly string[] };

type ItemAmount = { readonly name: string; readonly key: string; readonly measured: Measured };

const LETTER = /\p{L}/u;
const SCRIPTS = [/\p{Script=Hiragana}/u, /[\p{Script=Katakana}ー]/u, /\p{Script=Han}/u, /\p{Script=Latin}/u];
const NAME_WINDOW = 80;

const keyOf = (text: string): string => text.normalize("NFKC").toLowerCase();

const scriptOf = (char: string): number => SCRIPTS.findIndex((script) => script.test(char));

/** 二つの字の間が語の切れ目か。字でない側があるか、字の種類（仮名、漢字、英字）が変わる所。英字どうしは続いている。 */
const isBoundary = (left: string, right: string): boolean =>
  left === "" || right === "" || !LETTER.test(left) || !LETTER.test(right) || scriptOf(left) !== scriptOf(right);

const cellValue = (cell: Cell, source: string, measured: readonly Measured[]): Measured | undefined =>
  measured.find((value) => value.start >= cell.start && value.end <= cell.end && source.slice(value.start, value.end) === withoutEdgeMarks(cell.text));

/** 表の行の見出しと、その行の最初の量。同じ名前の行が二つあれば最初の行。 */
const tableAmounts = (source: string, rows: readonly Line[], measured: readonly Measured[]): ItemAmount[] => {
  const amounts = rows.flatMap((row): ItemAmount[] => {
    const [first, ...rest] = cellsOf(row);
    const name = first === undefined ? "" : withoutEdgeMarks(first.text);
    const value = rest.map((cell) => cellValue(cell, source, measured)).find((found) => found !== undefined);
    if (first === undefined || value === undefined || !LETTER.test(name) || cellValue(first, source, measured) !== undefined) return [];
    return [{ name, key: keyOf(name), measured: value }];
  });
  return amounts.filter((amount, index) => amounts.findIndex((other) => other.key === amount.key) === index);
};

/** 量のすぐ前に名前があるか（しょうゆ大さじ1、soy sauce 30 ml）。 */
const namedBefore = (source: string, value: Measured, key: string): boolean => {
  const end = source.charAt(value.start - 1) === " " ? value.start - 1 : value.start;
  const head = keyOf(source.slice(Math.max(0, end - NAME_WINDOW), end));
  return head.endsWith(key) && isBoundary(head.charAt(head.length - key.length - 1), key.charAt(0));
};

const skipSpace = (text: string): string => (text.startsWith(" ") ? text.slice(1) : text);

/** 頭の語を一つ落とす。英字の語は、後ろに空白が要る（of は offer の頭ではない）。 */
const dropWord = (text: string, words: readonly string[]): string | undefined => {
  const word = words.map(keyOf).find((candidate) => text.startsWith(candidate) && isBoundary(candidate.slice(-1), text.charAt(candidate.length)));
  return word === undefined ? undefined : skipSpace(text.slice(word.length));
};

/** つなぐ語を挟んで、量の後ろに名前があるか（30mlのしょうゆ、30 ml of the soy sauce）。 */
const namedAfter = (source: string, value: Measured, key: string, words: ItemWords): boolean => {
  const linked = dropWord(skipSpace(keyOf(source.slice(value.end, value.end + NAME_WINDOW))), words.links);
  if (linked === undefined) return false;
  const rest = dropWord(linked, words.determiners) ?? linked;
  return rest.startsWith(key) && isBoundary(key.slice(-1), rest.charAt(key.length));
};

/** 本文の量が、表の量をどう換算しても超えるか。表より少ない量は、その一部を使う所（牛乳の半分を先に）かもしれない。 */
const exceeds = (value: Measured, listed: Measured): boolean =>
  value.factors.every((a) => listed.factors.every((b) => (value.amount - value.zero) * a > (listed.amount - listed.zero) * b));

const inTable = (value: Measured, rows: readonly Line[]): boolean => rows.some((row) => value.start >= row.start && value.end <= row.start + row.text.length);

/** 本文の量のうち、表の同じ品物の量と単位が違い、換算すると合わないもの。 */
export const itemConflicts = (source: string, measured: readonly Measured[], words: ItemWords): ItemConflict[] => {
  const rows = tablesOf(linesOf(source)).flatMap((table) => [table.header, ...table.rows]);
  const amounts = tableAmounts(source, rows, measured);
  if (amounts.length === 0) return [];
  return measured
    .filter((value) => !inTable(value, rows))
    .flatMap((value): ItemConflict[] => {
      const item = amounts.find(
        ({ key, measured: listed }) => listed.dimension === value.dimension && (namedBefore(source, value, key) || namedAfter(source, value, key, words)),
      );
      if (
        item === undefined ||
        sameUnit(item.measured, value) ||
        sameMeasure(item.measured, value, toleranceOf(value.dimension)) ||
        !exceeds(value, item.measured)
      )
        return [];
      return [{ name: item.name, measured: value, other: item.measured }];
    });
};
