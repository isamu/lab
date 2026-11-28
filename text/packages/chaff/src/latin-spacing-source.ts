import type { Boundary } from "./orthography.ts";
import { hasGluedNumbers } from "./detectors/sentence-parts.ts";

// 英数字の前後の空け方が、書き手のものでない所。文献の記載の行（題名は出版されたとおりに写す）、変換で区切りが消えて
// 一続きになった表（升の区切りの空白）、行の頭の図表の札と題のあいだ（表 6種類の…）。Pure.

/**
 * 文献の記載（SIST の書き方）の行: 著者の後ろに「. 」、その後ろに「. 年,」（佐藤翔. 題. 誌名. 2019, （26）, p. 136-147.）。
 * 著者の欄は句点を含まない短い語の並び（佐藤翔, 鈴木一郎）。
 */
const ENTRY_AUTHOR = /^[ \t]*[^.。．\n]{1,60}\.\s/u;
const ENTRY_YEAR = /\.\s(?:1[89]|20)\d{2}[,，]/u;

export const isCitedEntryLine = (line: string): boolean => ENTRY_AUTHOR.test(line) && ENTRY_YEAR.test(line);

/** at を含む行。 */
export const lineAt = (text: string, at: number): string => {
  const end = text.indexOf("\n", at);
  return text.slice(text.lastIndexOf("\n", at - 1) + 1, end === -1 ? text.length : end);
};

/**
 * 変換で区切りが消えた数の表（桁の区切りの崩れた数の列 8,776,90087,769）を一つの文にしたものの、数の前後の境目。
 * 数の前後の空白は升の区切り。英字の前後は升の中の書き手の言葉なので数える（年表の「合弁会社 SANKO」）。
 */
export const isNumberTableBoundary = (text: string, boundary: Boundary): boolean => boundary.kind !== "letter" && hasGluedNumbers(text);

/** 行の頭の字下げと箇条書きの印。 */
const LINE_LEAD = /^[\s\-*+]*/u;

/** 境目が、行の頭に図表の札（表、図）だけを書いた後ろの空白か（表 6種類のCCライセンス）。札と題の区切りで、空け方の好みではない。 */
export const followsCaptionLabel = (text: string, boundary: Boundary, labels: ReadonlySet<string>): boolean =>
  boundary.spaced && labels.has(text.slice(text.lastIndexOf("\n", boundary.offset - 1) + 1, boundary.offset).replace(LINE_LEAD, ""));
