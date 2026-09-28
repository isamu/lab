import type { Span } from "./plugin.ts";

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
    if (!line.text.includes("\f")) return [];
    return [nearestText(lines, index, -1), line, nearestText(lines, index, 1)].flatMap((found) =>
      found === undefined ? [] : [{ start: found.start, end: found.end }],
    );
  });
};
