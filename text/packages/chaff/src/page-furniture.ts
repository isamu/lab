import type { Span } from "./plugin.ts";
import { NO_OUTLINE, type Outline } from "./structure/build.ts";
import { markdownFigures, textFigures, type MarkdownNode } from "./text-figures.ts";

/** 改ページから、飾りの行を探しにいく行数。飾りと改ページのあいだには空行が数行入る。 */
const REACH = 3;

type Line = { readonly start: number; readonly end: number; readonly text: string };

const linesOf = (source: string): Line[] => {
  const scan = { start: 0 };
  return source.split("\n").map((text) => {
    const line = { start: scan.start, end: scan.start + text.length, text };
    scan.start = line.end + 1;
    return line;
  });
};

const isBlank = (line: Line | undefined): boolean => line !== undefined && line.text.trim() === "";

/** 改ページだけの行。行の途中の \f は本文の一部（写し間違い）で、ページの区切りではない。 */
const PAGE_BREAK = /^[ \t]*\f[ \t\r]*$/u;

/** index から step の向きに、空行を飛ばして最初の空でない行。REACH 行を越えたら探さない。 */
const nearestText = (lines: readonly Line[], index: number, step: number): Line | undefined => {
  const candidates = Array.from({ length: REACH }, (_, offset) => lines[index + step * (offset + 1)]);
  const skipped = candidates.findIndex((line) => !isBlank(line));
  return skipped === -1 ? undefined : candidates[skipped];
};

/**
 * 紙の版を写したテキスト（RFC など）の、ページのヘッダーとフッター。改ページ（\f）の直前と直後の、空でない 1 行ずつ。
 * ページごとに同じ行が出るので、本文として読むと「同じ言い回しの繰り返し」や長い文になる。
 */
export const pageFurniture = (source: string): Span[] => {
  const lines = linesOf(source);
  return lines.flatMap((line, index) => {
    if (!PAGE_BREAK.test(line.text)) return [];
    return [nearestText(lines, index, -1), line, nearestText(lines, index, 1)].flatMap((found) =>
      found === undefined ? [] : [{ start: found.start, end: found.end }],
    );
  });
};

/** テキストの文書の外形。見出しもコードも無く、ページの飾り・線で描いた図・メールの引用した返信だけを覆う。木を作る入口はどれもこれを使う。 */
export const textOutline = (source: string, replyQuotes: readonly Span[] = []): Outline => ({
  ...NO_OUTLINE,
  opaque: [...pageFurniture(source), ...textFigures(source), ...replyQuotes],
});

/** 紙面の形で本文でないもの: テキストの文書のページの飾り（Markdown には改ページが無い）と、線で描いた図。 */
export const layoutMasks = (root: MarkdownNode, source: string, markdown: boolean): Span[] =>
  markdown ? markdownFigures(root, source) : [...pageFurniture(source), ...textFigures(source)];
