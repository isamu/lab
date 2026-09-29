import type { Sentence, Span, StructureNode, Token } from "../plugin.ts";

/** 番号の付いた行。start は行の始まり（字下げの前）、label は言語パッケージが読んだ番号（「（1）」）。 */
export type NumberedStart = { readonly start: number; readonly label: string };

const labelOf = (node: StructureNode): string => {
  const label = node.attrs["label"];
  return typeof label === "string" ? label : "";
};

/**
 * 条の外で、番号の付いた行（言語パッケージが項目と読んだ「（1）」など）。
 * 条の中の番号付きの行は、条の項（条の本文の続き）でもありうるので数えない。
 */
export const numberedStarts = (node: StructureNode, inArticle = false): NumberedStart[] => [
  ...(node.kind === "item" && !inArticle ? [{ start: node.span.start, label: labelOf(node) }] : []),
  ...node.children.flatMap((child) => numberedStarts(child, inArticle || node.kind === "article")),
];

const INDENT = /^[ \t\u3000]*/u;

const lineAt = (source: string, start: number): string => {
  const end = source.indexOf("\n", start);
  return source.slice(start, end === -1 ? source.length : end);
};

/** 番号の直後の語。字下げと番号と空白を飛ばした先の、最初の語。 */
const wordAfter = (numbered: NumberedStart, sentences: readonly Sentence[], source: string): Token | undefined => {
  const after = numbered.start + (INDENT.exec(lineAt(source, numbered.start))?.[0].length ?? 0) + numbered.label.length;
  const sentence = sentences.find((candidate) => candidate.span.end > after);
  return sentence?.tokens?.find((token) => token.span.start >= after && token.surface.trim() !== "");
};

/**
 * 並びの項目として番号を振った行の始まり。番号の直後が助詞（「（1）の金額は」「（2）は対象外」）なら、
 * 番号は項目の印ではなく、項目を指す本文の主語や修飾なので除く。
 */
export const enumeratorStarts = (numbered: readonly NumberedStart[], sentences: readonly Sentence[], source: string): number[] =>
  numbered.filter((line) => wordAfter(line, sentences, source)?.pos !== "ADP").map((line) => line.start);

/** 番号の付いた行の始まりと段落の始まりのあいだが字下げだけなら、段落はその行から始まる。 */
const opensWithItem = (paragraph: Span, starts: readonly number[], source: string): boolean =>
  starts.some((start) => start <= paragraph.start && source.slice(start, paragraph.start).trim() === "");

const isBlank = (source: string, from: number, to: number): boolean => source.slice(from, to).trim() === "";

/** 並びと読むのに要る、番号の付いた行の数。一つだけなら、並びではなく番号で始まる本文の段落かもしれない。 */
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
