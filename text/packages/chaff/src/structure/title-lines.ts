import type { MarkupHeading, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "./issues.ts";
import { lineNumberAt, type Line } from "./lines.ts";
import { isTitleWords } from "./contents-lines.ts";

// 題・見出しの行。見出しは節の中身に名前を付けるだけで、本文の文ではない。純関数: 木と行と Markdown の見出しを受け取る。

/** 見出しの行に、見出しの言葉のほかにあってよい字（括弧と空白）。法令の「（解雇の予告）」。 */
const CAPTION_MARKS = /[\s()（）［］[\]【】〔〕]/gu;

/** 条の前の行が、その条の見出しだけの行か。 */
const isCaptionLine = (line: Line | undefined, heading: string): boolean =>
  line !== undefined && heading !== "" && line.text.replaceAll(CAPTION_MARKS, "") === heading.replaceAll(CAPTION_MARKS, "");

/** 番号の行の題と読む字数の上限（（2）本件仮換地の指定等）。 */
const MAX_HEADING_LENGTH = 30;
/** 文の印。題はこれを持たない。 */
const SENTENCE_MARK = /[。．.，,、:：;；!?！？「」『』]/u;
/** 日本語の題の終わり: 名詞で終わり、述語（る・た・だ・い）では終わらない。 */
const NOUN_END = /[\p{Script=Han}\p{Script=Katakana}ー]$/u;
/** 番号の前に置いてよい箇条書きの印と空白。 */
const LIST_MARK = /^\s*(?:[-*+]\s+)?/u;

/** 番号の後ろの言葉が題か: 短く、文の印が無く、日本語なら名詞で終わり、英語なら題の語（Interim Land Designation）。 */
const isHeadingPhrase = (phrase: string): boolean =>
  phrase !== "" && phrase.length <= MAX_HEADING_LENGTH && !SENTENCE_MARK.test(phrase) && (NOUN_END.test(phrase) || isTitleWords(phrase));

/**
 * 項目の行が、下の段落に題を付けるだけの行か（(2) 本件仮換地の指定等 の下に「ア …（以下「本件仮換地」という。）」）。
 * 次の項目より前に自分の行より下の中身を持ち、行が番号と題だけのもの。一行で終わる短い項目（(a) the Seller pays）は文として読む。
 * 最後の項目は後ろの段落まで木の範囲に含むことがあり、中身を持つとは言えないので読まない。
 */
const isNumberedHeading = (node: StructureNode, line: Line | undefined, hasNext: boolean): boolean => {
  if (!hasNext || node.kind !== "item" || line === undefined || node.span.end <= line.start + line.text.length) return false;
  const text = line.text.normalize("NFKC").replace(LIST_MARK, "");
  const label = String(node.attrs["label"] ?? "").normalize("NFKC");
  return label !== "" && text.startsWith(label) && isHeadingPhrase(text.slice(label.length).trim());
};

/** 後ろに同じ親の項目が続く項目。 */
const itemsWithNext = (tree: StructureNode): ReadonlySet<StructureNode> =>
  new Set(
    inDocumentOrder(tree).flatMap((parent) => {
      const items = parent.children.filter((child) => child.kind === "item");
      return items.slice(0, -1);
    }),
  );

const lineNumbersOfTree = (tree: StructureNode, lines: readonly Line[]): number[] => {
  const followed = itemsWithNext(tree);
  return inDocumentOrder(tree).flatMap((node) => {
    if (node.kind === "chapter" || node.kind === "section") return [node.line];
    if (isNumberedHeading(node, lines[node.line - 1], followed.has(node))) return [node.line];
    if (node.kind !== "article") return [];
    const caption = node.line - 1;
    return isCaptionLine(lines[caption - 1], String(node.attrs["heading"] ?? "")) ? [caption] : [];
  });
};

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
