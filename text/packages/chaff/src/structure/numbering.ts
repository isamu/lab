import type { StructureNode } from "../plugin.ts";
import { inDocumentOrder, type StructureIssue } from "./issues.ts";

const labelOf = (node: StructureNode): string => String(node.attrs["label"] ?? node.address);

type Ordered = { readonly node: StructureNode; readonly ordinal: number };

/** 同じ親の子のうち、番号の付いたものを種類ごとに分ける。条と項は別の並び。 */
const sequencesOf = (parent: StructureNode): Ordered[][] => {
  const groups = new Map<string, Ordered[]>();
  parent.children.forEach((node) => {
    if (node.ordinal === undefined) return;
    // 配列を作り直さずに足す。条が何千もある法令で二乗にしない。
    const group = groups.get(node.kind) ?? [];
    group.push({ node, ordinal: node.ordinal });
    groups.set(node.kind, group);
  });
  return [...groups.values()];
};

/** 隣り合う二つの番号が、1 つ進んでいなければ指摘する。同じ番号なら重なり、飛べば抜け。 */
const breaksIn = (sequence: readonly Ordered[]): StructureIssue[] =>
  sequence.flatMap((current, index) => {
    const previous = sequence[index - 1];
    // 1 に戻ったら新しい並び。一つの条に (a)(b) の箇条書きが二つある、附則が第1条から振り直す、のどちらも誤りではない。
    if (previous === undefined || current.ordinal === previous.ordinal + 1 || current.ordinal === 1) return [];
    return [
      {
        offset: current.node.span.start,
        values: { previous: labelOf(previous.node), label: labelOf(current.node), expected: previous.ordinal + 1, found: current.ordinal },
      },
    ];
  });

/**
 * 番号の抜けと重なり。比べるのは同じ親の子どうしだけ。英米の法令は章ごとに Section 101、201 と百の位を変えるので、
 * 文書全体の通し番号として比べると抜けに見える。最初の番号は見ない。日本語の項は 2 から番号を振る。
 * 1 に戻った番号は新しい並びの始まりとして扱うので、「(a) の後の (a)」の重なりは見逃す。
 */
export const numberingBreaks = (tree: StructureNode): StructureIssue[] =>
  inDocumentOrder(tree)
    .flatMap(sequencesOf)
    .flatMap(breaksIn)
    .sort((left, right) => left.offset - right.offset);
