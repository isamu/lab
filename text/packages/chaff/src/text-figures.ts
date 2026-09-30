import type { Span } from "./plugin.ts";
import { mergeSpans } from "./span-merge.ts";
import { eachPreOrder } from "./tree-walk.ts";

/**
 * 線と矢印で描いた図（RFC の状態遷移図、やり取りの図、枠の表）。文ではないので、コードブロックと同じく本文から外す。
 *
 * 見分けるのは形だけ。線の文字が多いか、語のあいだを 3 字以上空けて桁をそろえた行で、文の句読点が無いもの。
 * そういう行が続く塊（行のあいだの空行は 1 行まで）のうち、2 行以上あり、線の行を 1 行でも含むものを図とする。
 * 句読点の無い短い行（図の中の「(Close)」）は、図の行に挟まれていれば図に入る。塊の端にあれば入らない。
 * 語の多い行は、句読点が無くても文の行（折り返した文の途中）として塊を切る。
 * 桁をそろえただけの語の表は、線が無ければ本文のまま読む。
 */

/** 線を引く文字。ASCII の + - | / \ < > ^ = と、U+2500 台の罫線・U+25A0 台の図形（▶ ▼）。 */
const LINE_CHAR = /[+\-|/\\<>^=\u2500-\u25FF]/gu;
/** 下向きの矢印として一文字で立つ v。語の中の v は数えない。 */
const ARROW_V = /(?<=^|\s)[vV](?=\s|$)/gu;
/** 線の文字が 3 つ続けば線（-->、+---+、<==）。 */
const LINE_RUN = /[+\-|/\\<>^=\u2500-\u25FF]{3,}/gu;
/** ただし「---」ちょうどは、語のあいだのダッシュ（47.041 --- Engineering）。 */
const DASH = /^-{3}$/u;
/** 行の空白以外の文字のうち、この割合以上が線の文字なら線の行。「== Community ==」のような見出しの印は半分に届かない。 */
const LINE_SHARE = 0.5;
/** 割合で線の行と読むのに要る、線の文字の数。箇条書きの「- EU」は印が 1 つだけ。 */
const MIN_LINE_CHARS = 2;
/** 語のあいだの 3 字以上の空白は、桁をそろえた印。文の区切りの空白は 2 字まで（RFC は文のあいだを 2 字空ける）。 */
const COLUMN_GAP = /\S {3,}\S/u;
/** 文の印: 語の直後の句読点に、次の語が続く（"reply. It"、"link, then"）。日本語は句点か読点があれば文。 */
const SENTENCE = /\p{L}\p{L}[.,;:?!]["')\]]?\s+\p{L}|[。、]/u;
/**
 * 同じ線の文字だけの行（-----、==== ====）。見出しの下線や段の区切りで、図の中にあってもよいが図の印にはならない。
 * 印にすると、区切りの線 2 本に挟まれた題（===== / Title / =====）や、下線を引いた見出しの前の箇条書きまで図になる。
 */
const RULE_LINE = /^\s*([-=_~*])\1*(?:\s+\1+)*\s*$/u;
/** 行頭の箇条書きの印（-、*、+、1.、a)）。印の後ろの空白は桁そろえではない。 */
const LIST_MARK = /^\s*(?:[-*+]|\p{N}{1,3}[.)]|\p{L}[.)])(?=\s)/u;
/** 語。句読点の無い行でも、語が多ければ文の一部（折り返した文の行）で、図の中の注記ではない。 */
const WORD = /\p{L}[\p{L}\p{N}'-]*/gu;
/** 図の中の注記（「(Close)」「(2 MSL)」「CLOSED」）の語の数の上限。 */
const MAX_PLAIN_WORDS = 4;
/** 図の中で、行と行のあいだに置ける空行の数。 */
const MAX_BLANK_RUN = 1;
/** 図と読むのに要る行の数。区切りの線 1 行は図ではない。 */
const MIN_FIGURE_LINES = 2;

/** line は線の行、column は桁そろえの行、plain は句読点の無い行と区切りの線（図の中にあってよい）、text は文の行。 */
type Kind = "line" | "column" | "plain" | "blank" | "text";

type Row = { readonly start: number; readonly end: number; readonly kind: Kind };

const matchesOf = (text: string, pattern: RegExp): string[] => [...text.matchAll(pattern)].map((match) => match[0]);

const count = (text: string, pattern: RegExp): number => matchesOf(text, pattern).length;

/** 箇条書きの印は線に数えない（「- /」はパンくずの区切り）。 */
const isLineArt = (text: string): boolean => {
  const body = text.replace(LIST_MARK, "");
  const visible = body.replace(/\s/gu, "").length;
  const drawn = count(body, LINE_CHAR) + count(body, ARROW_V);
  return matchesOf(body, LINE_RUN).some((run) => !DASH.test(run)) || (drawn >= MIN_LINE_CHARS && drawn >= visible * LINE_SHARE);
};

const kindOf = (text: string): Kind => {
  if (text.trim() === "") return "blank";
  if (SENTENCE.test(text)) return "text";
  if (RULE_LINE.test(text)) return "plain";
  if (isLineArt(text)) return "line";
  if (COLUMN_GAP.test(text.replace(LIST_MARK, "").trimStart())) return "column";
  return count(text, WORD) > MAX_PLAIN_WORDS ? "text" : "plain";
};

/** skip の中で始まる行は、文の行と同じく塊を切る。行も範囲も先頭から順に進むので、行ごとに範囲を全部なめない。 */
const rowsOf = (source: string, skip: readonly Span[]): Row[] => {
  const regions = mergeSpans(skip, false);
  const scan = { start: 0, region: 0 };
  return source.split("\n").map((text) => {
    while ((regions[scan.region]?.end ?? Number.POSITIVE_INFINITY) <= scan.start) scan.region += 1;
    const region = regions[scan.region];
    const skipped = region !== undefined && region.start <= scan.start;
    const row: Row = { start: scan.start, end: scan.start + text.length, kind: skipped ? "text" : kindOf(text) };
    scan.start = row.end + 1;
    return row;
  });
};

/** 図の行の塊。空行が MAX_BLANK_RUN を超えて続くか、文の行が来たら切れる。塊の端の空行と句読点の無い行は入れない。 */
const runsOf = (rows: readonly Row[]): Row[][] => {
  // 行ごとに配列を作り直すと、何万行の文書で行数の二乗になる。塊は押し足していく。
  const runs: Row[][] = [[]];
  const scan = { blanks: 0 };
  const cut = (): void => {
    if ((runs.at(-1) ?? []).length > 0) runs.push([]);
  };
  rows.forEach((row) => {
    if (row.kind === "blank") {
      scan.blanks += 1;
      if (scan.blanks > MAX_BLANK_RUN) cut();
      return;
    }
    scan.blanks = 0;
    if (row.kind === "text") cut();
    else runs.at(-1)?.push(row);
  });
  return runs.map(trimPlain).filter((run) => run.length > 0);
};

const isDrawn = (row: Row): boolean => row.kind === "line" || row.kind === "column";

const trimPlain = (run: readonly Row[]): Row[] => {
  const first = run.findIndex(isDrawn);
  return first === -1 ? [] : run.slice(first, run.findLastIndex(isDrawn) + 1);
};

const isFigure = (run: readonly Row[]): boolean => run.filter(isDrawn).length >= MIN_FIGURE_LINES && run.some((row) => row.kind === "line");

/**
 * テキストの図の範囲。最初の行の頭から最後の行の終わりまで（あいだの空行も入る）。source は LF でそろえたもの。
 * skip は図と別に読む範囲（Markdown のコード・表・HTML・見出し）。その中の行は図の行に数えない。
 */
export const textFigures = (source: string, skip: readonly Span[] = []): Span[] =>
  runsOf(rowsOf(source, skip))
    .filter(isFigure)
    .map((run) => ({ start: run[0]?.start ?? 0, end: run.at(-1)?.end ?? 0 }));

type Place = { readonly offset?: number | undefined };
export type MarkdownNode = {
  readonly type: string;
  readonly position?: { readonly start: Place; readonly end: Place } | undefined;
  readonly children?: readonly MarkdownNode[] | undefined;
};

/** Markdown が図と別に読む塊。この中の線は図として探さない（コードはもともと本文でなく、表の区切りの行は表、見出しは見出し）。 */
const NOT_FIGURE: ReadonlySet<string> = new Set(["code", "table", "html", "heading"]);

/** Markdown の図。コード・表・HTML・見出しの外に描かれたものだけ。 */
export const markdownFigures = (root: MarkdownNode, source: string): Span[] => {
  const skip: Span[] = [];
  eachPreOrder(root, (node) => {
    const [start, end] = [node.position?.start.offset, node.position?.end.offset];
    if (NOT_FIGURE.has(node.type) && start !== undefined && end !== undefined) skip.push({ start, end });
  });
  return textFigures(source, skip);
};
