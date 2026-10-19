import type { MarkupHeading } from "../plugin.ts";
import { lineNumberAt, type Line } from "./lines.ts";

// 要約の節（要旨、裁判要旨、Summary）の行。本文を先に縮めて書いた所で、本文の語の使い始めではない。純関数: 行と見出しと要約の名前を受け取る。

/** 要約の見出しの下、次の見出しまでの行の番号（1 始まり）。見出しは名前のどれかとまるごと同じもの（大文字小文字は問わない）。 */
export const summaryLineNumbers = (lines: readonly Line[], headings: readonly MarkupHeading[], names: readonly string[]): ReadonlySet<number> => {
  const known = new Set(names.map((name) => name.toLowerCase()));
  return new Set(
    headings.flatMap((heading, index) => {
      if (!known.has(heading.text.trim().toLowerCase())) return [];
      const from = lineNumberAt(lines, heading.start) ?? 0;
      const next = headings[index + 1];
      const to = next === undefined ? lines.length + 1 : (lineNumberAt(lines, next.start) ?? lines.length + 1);
      return lines.filter((line) => line.number > from && line.number < to).map((line) => line.number);
    }),
  );
};
