import type { MarkupHeading } from "../plugin.ts";
import { lineNumberAt, type Line } from "./lines.ts";

// 要約の節（要旨、裁判要旨、Summary）の行。本文を先に縮めて書いた所で、本文の語の使い始めではない。純関数: 行と見出しと要約の名前を受け取る。

/** 要約の節の、見出しの下の最初の行と最後の行（1 始まり）。 */
export type SummaryLines = { readonly from: number; readonly to: number };

/** 要約の見出しの下、次の見出しまでの行。見出しは名前のどれかとまるごと同じもの（大文字小文字は問わない）。 */
export const summarySections = (lines: readonly Line[], headings: readonly MarkupHeading[], names: readonly string[]): SummaryLines[] => {
  const known = new Set(names.map((name) => name.toLowerCase()));
  return headings.flatMap((heading, index) => {
    if (!known.has(heading.text.trim().toLowerCase())) return [];
    const from = (lineNumberAt(lines, heading.start) ?? 0) + 1;
    const next = headings[index + 1];
    const to = next === undefined ? lines.length : (lineNumberAt(lines, next.start) ?? lines.length + 1) - 1;
    return from <= to ? [{ from, to }] : [];
  });
};

/**
 * 語を使った行が要約の節にあり、定義の行がその節の外にあるか。要約は本文の定義を先取りして縮めたもので、使い始めではない。
 * 同じ要約の中で定義より前に使った所は、要約の中の誤りなので数える。
 */
export const summarisesLaterDefinition = (sections: readonly SummaryLines[], useLine: number, definitionLine: number): boolean =>
  sections.some((section) => section.from <= useLine && useLine <= section.to && (definitionLine < section.from || section.to < definitionLine));
