import type { Span } from "./plugin.ts";

/**
 * 文献一覧の範囲。見出しの語（参考文献、References）で見つけ、構造で範囲を決める。
 * Markdown の見出しなら、次の同じ深さか浅い見出しまで。見出しの語だけの段落（HTML から写した文書）なら、すぐ後に続く箇条書きだけ。
 * 箇条書きが続かなければ文献一覧とは言えないので、何も返さない。
 */
type Line = { readonly text: string; readonly start: number; readonly end: number };

const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t](.*))?$/u;
// 文献の番号（- [1]、1.、[1]）で始まる行。
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,4}[.)]|\[\d{1,4}\])[ \t]/u;
const CONTINUATION = /^[ \t]+\S/u;
// 見出しの前の節番号（7.、7.1、VII.）、周りの強調、後ろの閉じの # とコロン。
const SECTION_NUMBER = /^(?:\d+(?:\.\d+)*\.?|[IVXLC]+\.)\s+/u;
const EMPHASIS_MARKS = ["**", "__"] as const;
const CLOSING = new Set([" ", "\t", "#", ":", "："]);

const withoutClosing = (text: string): string => {
  const characters = [...text];
  return characters.slice(0, characters.findLastIndex((character) => !CLOSING.has(character)) + 1).join("");
};

const linesOf = (source: string): Line[] =>
  source.split("\n").reduce<Line[]>((lines, text) => {
    const start = (lines.at(-1)?.end ?? -1) + 1;
    lines.push({ text, start, end: start + text.length });
    return lines;
  }, []);

const withoutEmphasis = (text: string): string => {
  const mark = EMPHASIS_MARKS.find((candidate) => text.length > candidate.length * 2 && text.startsWith(candidate) && text.endsWith(candidate));
  return mark === undefined ? text : text.slice(mark.length, -mark.length);
};

const isBlank = (line: Line | undefined): boolean => line === undefined || line.text.trim() === "";

const headingWord = (text: string): string => {
  const plain = withoutEmphasis(withoutClosing(text).trim());
  return withoutClosing(plain.replace(SECTION_NUMBER, "")).trim().toLowerCase();
};

const levelOf = (line: Line): number | undefined => ATX_HEADING.exec(line.text)?.[1]?.length;

/** from 以降で最初に test を満たす行。無ければ lines.length。先頭から数え直すと、見出しの多い文書で行数の 2 乗になる。 */
const firstFrom = (lines: readonly Line[], from: number, test: (line: Line) => boolean): number => {
  for (let index = from; index < lines.length; index += 1) {
    const line = lines[index];
    if (line !== undefined && test(line)) return index;
  }
  return lines.length;
};

/** Markdown の見出しの節の終わり: 次の同じ深さか浅い見出しの手前。無ければ文書の終わり。 */
const sectionEnd = (lines: readonly Line[], at: number, level: number): number =>
  firstFrom(lines, at + 1, (line) => (levelOf(line) ?? Number.POSITIVE_INFINITY) <= level);

const isOutsideList = (line: Line): boolean => !isBlank(line) && !LIST_ITEM.test(line.text) && !CONTINUATION.test(line.text);

/** from の後の最初の中身の行から続く箇条書きの終わり（最後の中身の行の次）。最初の中身が項目でなければ from。 */
const listEnd = (lines: readonly Line[], from: number): number => {
  const first = firstFrom(lines, from, (line) => !isBlank(line));
  if (!LIST_ITEM.test(lines[first]?.text ?? "")) return from;
  const stop = firstFrom(lines, first + 1, isOutsideList);
  return first + lines.slice(first, stop).findLastIndex((line) => !isBlank(line)) + 1;
};

const standsAlone = (lines: readonly Line[], at: number): boolean => (at === 0 || isBlank(lines[at - 1])) && isBlank(lines[at + 1]);

/** 見出しの行 at から、文献一覧の終わりの行（含まない）。文献一覧の見出しでなければ undefined。 */
const blockEnd = (lines: readonly Line[], at: number, headings: ReadonlySet<string>): number | undefined => {
  const line = lines[at];
  if (line === undefined) return undefined;
  const level = levelOf(line);
  if (level !== undefined) return headings.has(headingWord(ATX_HEADING.exec(line.text)?.[2] ?? "")) ? sectionEnd(lines, at, level) : undefined;
  if (!headings.has(headingWord(line.text)) || !standsAlone(lines, at)) return undefined;
  const end = listEnd(lines, at + 1);
  return end === at + 1 ? undefined : end;
};

export const referenceListSpans = (source: string, headingWords: readonly string[]): Span[] => {
  const headings = new Set(headingWords.map((word) => word.toLowerCase()));
  const lines = linesOf(source);
  const spans: Span[] = [];
  lines.forEach((line, at) => {
    if ((spans.at(-1)?.end ?? -1) >= line.start) return;
    const end = blockEnd(lines, at, headings);
    if (end !== undefined) spans.push({ start: line.start, end: lines[end - 1]?.end ?? line.end });
  });
  return spans;
};
