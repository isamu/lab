import type { Span, StructureNode } from "../plugin.ts";
import { inDocumentOrder, type StructureIssue } from "./issues.ts";
import { numbersQuotedInside } from "./quoted-number.ts";
import { isVersionHistory } from "./version-order.ts";
import { withRepeatsNamed } from "./repeated-number.ts";
import { labelWrittenBetween } from "./unread-label.ts";

const labelOf = (node: StructureNode): string => String(node.attrs["label"] ?? node.address);

/** sideSteps は、この番号の直前にある番号の無い手順（GOV.UK の「and」）の数。それぞれが番号を一つ使っていてよい。 */
type Ordered = { readonly node: StructureNode; readonly ordinal: number; readonly last: number; readonly sideSteps: number };

/**
 * isAlternative は、別案と書いた条（alternative-clause.ts）。restarts は、番号を空けた条（第●条）が始まる位置で、
 * そこから項の番号を振り直す。どちらも始まりの順。
 */
export type ClauseReadings = { readonly isAlternative: (node: StructureNode) => boolean; readonly restarts: readonly number[] };

const NO_CLAUSES: ClauseReadings = { isAlternative: () => false, restarts: [] };

/**
 * What a skip is checked against besides the tree. source: the text, for labels set out that the tree did not read
 * (unread-label.ts). isPartialHeading: a heading saying what is under it is only some (抜粋, excerpt), where numbers skip by choice.
 */
export type SkipReadings = { readonly source: string; readonly isPartialHeading: (heading: string) => boolean };

const NO_SKIPS: SkipReadings = { source: "", isPartialHeading: () => false };

const OPENING_BRACKET = /^[([{〔【〈《]/u;

/** 括弧で囲んだ番号（（1）、(a)）か。全角と半角は同じに見る。 */
const isBracketed = (label: string): boolean => OPENING_BRACKET.test(label.normalize("NFKC"));

/**
 * 同じ親の子のうち、番号の付いたものを種類と深さと書き方ごとに分ける。条と項は別の並び、項と号も別の並び。
 * 法令の第 1 項は番号が無いので、その号（一、二）と第 2 項（２）は同じ条の直下に並ぶ。深さで分けないと「二の次が２」に見える。
 * 社内規程は号の（1）（2）と第 2 項の「2」を同じ深さに読むことがあるので、括弧で囲んだ番号は囲まない番号と別の並びにする。
 */
const sequencesOf = (
  parent: StructureNode,
  quoting: ReadonlySet<StructureNode>,
  isSideStep: (node: StructureNode) => boolean,
  clauses: ClauseReadings,
): Ordered[][] => {
  const groups = new Map<string, Ordered[]>();
  let sideSteps = 0;
  parent.children.forEach((node) => {
    if (node.ordinal === undefined) {
      if (isSideStep(node)) sideSteps += 1;
      return;
    }
    if (quoting.has(node)) return;
    const key = `${node.kind}/${String(node.level ?? "")}/${isBracketed(labelOf(node)) ? "bracketed" : "bare"}`;
    // 配列を作り直さずに足す。条が何千もある法令で二乗にしない。
    const group = groups.get(key) ?? [];
    // 前と同じ番号で別案と書いた条（第4条の後の第4条（変更オプション条項））は、その条の代わりに選ぶもので、番号を使わない。
    if (group.at(-1)?.last === node.ordinal && clauses.isAlternative(node)) return;
    group.push({ node, ordinal: node.ordinal, last: node.ordinalTo ?? node.ordinal, sideSteps });
    groups.set(key, group);
    sideSteps = 0;
  });
  return [...groups.values()];
};

/** start が after より後ろの最初の範囲。unread は始まりの順に並ぶ。 */
const firstStartingAfter = (unread: readonly Span[], after: number): number => {
  let low = 0;
  let high = unread.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((unread[middle]?.start ?? Infinity) > after) high = middle;
    else low = middle + 1;
  }
  return low;
};

/** 二つの番号のあいだに、読めなかった範囲が始まるか。 */
const unreadBetween = (unread: readonly Span[], previous: Ordered, current: Ordered): boolean =>
  (unread[firstStartingAfter(unread, previous.node.span.start)]?.start ?? Infinity) < current.node.span.start;

/**
 * 隣り合う二つの番号が、1 つ進んでいなければ指摘する。同じ番号なら重なり、飛べば抜け。
 * あいだに読めなかった範囲（unread）があれば、抜けた番号はそこにあるかもしれないので言わない。重なりは言う。
 */
const breaksIn =
  (unread: readonly Span[], restarts: readonly Span[], isSkipAllowed: (previous: Ordered, current: Ordered) => boolean) =>
  (sequence: readonly Ordered[]): StructureIssue[] =>
    sequence.flatMap((current, index) => {
      const previous = sequence[index - 1];
      // 1 に戻ったら新しい並び。一つの条に (a)(b) の箇条書きが二つある、附則が第1条から振り直す、のどちらも誤りではない。
      // 範囲をまとめた行（第四十三条から第五十五条まで）の次は、範囲の最後から数える。
      if (previous === undefined || current.ordinal === previous.last + 1 || current.ordinal === 1) return [];
      if (unreadBetween(restarts, previous, current)) return [];
      if (current.ordinal > previous.last + 1 && unreadBetween(unread, previous, current)) return [];
      if (current.ordinal > previous.last + 1 && current.ordinal <= previous.last + 1 + current.sideSteps) return [];
      if (current.ordinal > previous.last + 1 && isSkipAllowed(previous, current)) return [];
      return [
        {
          offset: current.node.span.start,
          values: { previous: labelOf(previous.node), label: labelOf(current.node), expected: previous.last + 1, found: current.ordinal },
        },
      ];
    });

/** 抜粋と書いた見出し（## 根拠条文の抜粋）の下の節点。そこの番号は選んで引いたので、飛んでよい。 */
const underPartialHeadings = (tree: StructureNode, isPartialHeading: (heading: string) => boolean): Set<StructureNode> => {
  const under = new Set<StructureNode>();
  const pending: [StructureNode, boolean][] = [[tree, false]];
  while (pending.length > 0) {
    const [node, inherited] = pending.pop() ?? [tree, false];
    const heading = node.attrs["heading"];
    const partial = inherited || (node.kind === "section" && typeof heading === "string" && isPartialHeading(heading));
    if (partial) under.add(node);
    node.children.forEach((child) => pending.push([child, partial]));
  }
  return under;
};

/** 並びの始まりの番号。番号は 1 から振る（法令の項は 2 から）。 */
const LAST_START = 2;

/**
 * 番号が一つしかなく、それが並びの始まりでない並び（用語集の見出し Section 508 Program、Section 508 Program Manager）は
 * 名前で、番号の並びではない。法令の「２」「2」と続く項（第 1 項は番号が無い）は重なり。
 */
const isOneNumber = (sequence: readonly Ordered[]): boolean => {
  const [first] = sequence;
  return first !== undefined && sequence.length > 1 && first.ordinal > LAST_START && sequence.every((ordered) => ordered.ordinal === first.ordinal);
};

/**
 * 番号の抜けと重なり。比べるのは同じ親の子どうしだけ。英米の法令は章ごとに Section 101、201 と百の位を変えるので、
 * 文書全体の通し番号として比べると抜けに見える。最初の番号は見ない。日本語の項は 2 から番号を振る。
 * 1 に戻った番号は新しい並びの始まりとして扱うので、「(a) の後の (a)」の重なりは見逃す。
 * 同じ番号の節を中に持つ節（ほかの文書の条を引いた手本の見出し）は、並びに入れない。
 * 変更履歴の版の見出し（## 3.1.0）は番号の並びではない。版の順番は version-order が見る。
 * 同じ番号が二度続いて次が飛ぶ（4.1、4.1、4.3）ものは、重なりと抜けに分けず、二つ目で一度だけ言う（repeated-number.ts）。
 * unread は、読み手には見えるが木に入らない範囲（Markdown の HTML ブロックの中の文字）を、始まりの順に並べたもの。
 * isSideStep は、番号の代わりに「and」と書いた手順（前の手順と並べて行う）。その数だけ、次の番号は飛んでよい。
 * clauses は、別案の条（並びに入れない）と、番号を空けた条の位置（そこから振り直す）。
 * skips は、抜けを言わない場合: 抜けた番号を木が読まずに本文に書いてある（(e) の前の行末の (d)）か、抜粋と書いた見出しの下。
 */
export const numberingBreaks = (
  tree: StructureNode,
  unread: readonly Span[] = [],
  isSideStep: (node: StructureNode) => boolean = () => false,
  clauses: ClauseReadings = NO_CLAUSES,
  skips: SkipReadings = NO_SKIPS,
): StructureIssue[] => {
  const quoting = numbersQuotedInside(tree);
  const restarts = clauses.restarts.map((start) => ({ start, end: start }));
  const partial = underPartialHeadings(tree, skips.isPartialHeading);
  const spanOf = (ordered: Ordered): { label: string; ordinal: number; start: number; last: number } => ({
    label: labelOf(ordered.node),
    ordinal: ordered.ordinal,
    start: ordered.node.span.start,
    last: ordered.last,
  });
  const isSkipAllowed = (previous: Ordered, current: Ordered): boolean =>
    partial.has(current.node) || labelWrittenBetween(skips.source, spanOf(previous), spanOf(current));
  const breaks = inDocumentOrder(tree)
    .flatMap((parent) => sequencesOf(parent, quoting, isSideStep, clauses))
    .filter((sequence) => !isVersionHistory(sequence.map((ordered) => labelOf(ordered.node))) && !isOneNumber(sequence))
    .flatMap(breaksIn(unread, restarts, isSkipAllowed));
  return withRepeatsNamed(tree, quoting, breaks, unread);
};
