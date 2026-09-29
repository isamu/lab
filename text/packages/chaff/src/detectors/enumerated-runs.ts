import type { Span, StructureNode } from "../plugin.ts";

/**
 * 条の外で、番号の付いた行（言語パッケージが項目と読んだ「（1）」など）の始まり。
 * 条の中の番号付きの行は、条の項（条の本文の続き）でもありうるので数えない。
 */
export const itemStarts = (node: StructureNode, inArticle = false): number[] => [
  ...(node.kind === "item" && !inArticle ? [node.span.start] : []),
  ...node.children.flatMap((child) => itemStarts(child, inArticle || node.kind === "article")),
];

/** 番号の付いた行の始まりと段落の始まりのあいだが字下げだけなら、段落はその行から始まる。 */
const opensWithItem = (paragraph: Span, starts: readonly number[], source: string): boolean =>
  starts.some((start) => start <= paragraph.start && source.slice(start, paragraph.start).trim() === "");

const isBlank = (source: string, from: number, to: number): boolean => source.slice(from, to).trim() === "";

/** 並びと読むのに要る、番号の付いた行の数。一つだけなら「（1）の金額は」のような参照で始まる本文かもしれない。 */
const MIN_ITEMS = 2;

/** 番号の行の始まりは字下げの前なので、並びの最初の行の頭から数える。 */
const itemsIn = (run: Span, starts: readonly number[], source: string): number => {
  const lineStart = source.lastIndexOf("\n", run.start - 1) + 1;
  return starts.filter((start) => start >= lineStart && start < run.end).length;
};

/**
 * 番号で始まる段落が、空行だけを挟んで続く範囲。番号の付いた行を二つ以上含むものだけ。
 * 要件や条件を「（1）…であること。」と並べるのは、段落でも箇条書きと同じ書き方で、本文の調子とは別に揃える。
 */
export const enumeratedRuns = (paragraphs: readonly Span[], starts: readonly number[], source: string): Span[] => {
  const enumerated = paragraphs.filter((paragraph) => opensWithItem(paragraph, starts, source));
  const runs = enumerated.reduce<Span[]>((joined, paragraph) => {
    const last = joined.at(-1);
    if (last === undefined || !isBlank(source, last.end, paragraph.start)) return [...joined, paragraph];
    return [...joined.slice(0, -1), { start: last.start, end: paragraph.end }];
  }, []);
  return runs.filter((run) => itemsIn(run, starts, source) >= MIN_ITEMS);
};
