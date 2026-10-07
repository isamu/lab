import type { MarkupHeading, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "./issues.ts";
import { lineNumberAt, type Line } from "./lines.ts";

// 題・見出しの行。見出しは節の中身に名前を付けるだけで、本文の文ではない。純関数: 木と行と Markdown の見出しを受け取る。

/** 見出しの行に、見出しの言葉のほかにあってよい字（括弧と空白）。法令の「（解雇の予告）」。 */
const CAPTION_MARKS = /[\s()（）［］[\]【】〔〕]/gu;

/** 条の前の行が、その条の見出しだけの行か。 */
const isCaptionLine = (line: Line | undefined, heading: string): boolean =>
  line !== undefined && heading !== "" && line.text.replaceAll(CAPTION_MARKS, "") === heading.replaceAll(CAPTION_MARKS, "");

const lineNumbersOfTree = (tree: StructureNode, lines: readonly Line[]): number[] =>
  inDocumentOrder(tree).flatMap((node) => {
    if (node.kind === "chapter" || node.kind === "section") return [node.line];
    if (node.kind !== "article") return [];
    const caption = node.line - 1;
    return isCaptionLine(lines[caption - 1], String(node.attrs["heading"] ?? "")) ? [caption] : [];
  });

/**
 * 題・見出しの行の番号（1 始まり）。Markdown の見出しの行、木の章・節の行、条の前に置いた見出しだけの行。
 * 条の行の中の見出し（第一条（目的））は条の本文と同じ行なので入れない。
 */
export const titleLineNumbers = (tree: StructureNode | undefined, lines: readonly Line[], headings: readonly MarkupHeading[]): ReadonlySet<number> =>
  new Set([
    ...(tree === undefined ? [] : lineNumbersOfTree(tree, lines)),
    ...headings.flatMap((heading) => {
      const line = lineNumberAt(lines, heading.start);
      return line === undefined ? [] : [line];
    }),
  ]);
