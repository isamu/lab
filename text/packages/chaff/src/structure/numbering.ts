import type { StructureNode } from "../plugin.ts";
import { inDocumentOrder, type StructureIssue } from "./issues.ts";
import { numbersQuotedInside } from "./quoted-number.ts";

const labelOf = (node: StructureNode): string => String(node.attrs["label"] ?? node.address);

type Ordered = { readonly node: StructureNode; readonly ordinal: number; readonly last: number };

/**
 * 同じ親の子のうち、番号の付いたものを種類と深さごとに分ける。条と項は別の並び、項と号も別の並び。
 * 法令の第 1 項は番号が無いので、その号（一、二）と第 2 項（２）は同じ条の直下に並ぶ。深さで分けないと「二の次が２」に見える。
 */
const sequencesOf = (parent: StructureNode, quoting: ReadonlySet<StructureNode>): Ordered[][] => {
  const groups = new Map<string, Ordered[]>();
  parent.children.forEach((node) => {
    if (node.ordinal === undefined || quoting.has(node)) return;
    const key = `${node.kind}/${String(node.level ?? "")}`;
    // 配列を作り直さずに足す。条が何千もある法令で二乗にしない。
    const group = groups.get(key) ?? [];
    group.push({ node, ordinal: node.ordinal, last: node.ordinalTo ?? node.ordinal });
    groups.set(key, group);
  });
  return [...groups.values()];
};

/** 隣り合う二つの番号が、1 つ進んでいなければ指摘する。同じ番号なら重なり、飛べば抜け。 */
const breaksIn = (sequence: readonly Ordered[]): StructureIssue[] =>
  sequence.flatMap((current, index) => {
    const previous = sequence[index - 1];
    // 1 に戻ったら新しい並び。一つの条に (a)(b) の箇条書きが二つある、附則が第1条から振り直す、のどちらも誤りではない。
    // 範囲をまとめた行（第四十三条から第五十五条まで）の次は、範囲の最後から数える。
    if (previous === undefined || current.ordinal === previous.last + 1 || current.ordinal === 1) return [];
    return [
      {
        offset: current.node.span.start,
        values: { previous: labelOf(previous.node), label: labelOf(current.node), expected: previous.last + 1, found: current.ordinal },
      },
    ];
  });

/**
 * 番号の抜けと重なり。比べるのは同じ親の子どうしだけ。英米の法令は章ごとに Section 101、201 と百の位を変えるので、
 * 文書全体の通し番号として比べると抜けに見える。最初の番号は見ない。日本語の項は 2 から番号を振る。
 * 1 に戻った番号は新しい並びの始まりとして扱うので、「(a) の後の (a)」の重なりは見逃す。
 * 同じ番号の節を中に持つ節（ほかの文書の条を引いた手本の見出し）は、並びに入れない。
 */
export const numberingBreaks = (tree: StructureNode): StructureIssue[] => {
  const quoting = numbersQuotedInside(tree);
  return inDocumentOrder(tree)
    .flatMap((parent) => sequencesOf(parent, quoting))
    .flatMap(breaksIn)
    .toSorted((left, right) => left.offset - right.offset);
};
