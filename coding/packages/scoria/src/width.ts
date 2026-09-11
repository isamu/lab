/**
 * Column width of text as a terminal draws it.
 *
 * `padEnd` counts code points, so a table padded with it collapses the moment a column holds
 * Japanese: 次元 is two code points but four columns. Every aligned column goes through here.
 */

/** East Asian Wide and Fullwidth ranges, enough to cover CJK and kana. */
const WIDE_RANGES: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
];

const isWide = (codePoint: number): boolean => WIDE_RANGES.some(([from, to]) => codePoint >= from && codePoint <= to);

export const displayWidth = (text: string): number => [...text].reduce((width, character) => width + (isWide(character.codePointAt(0) ?? 0) ? 2 : 1), 0);

const fill = (text: string, width: number): string => " ".repeat(Math.max(0, width - displayWidth(text)));

export const padEndWide = (text: string, width: number): string => text + fill(text, width);

export const padStartWide = (text: string, width: number): string => fill(text, width) + text;
