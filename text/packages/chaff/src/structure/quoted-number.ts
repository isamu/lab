import type { StructureNode } from "../plugin.ts";

type Visit = { readonly node: StructureNode; readonly leaving: boolean };

const keyOf = (node: StructureNode): string | undefined => (node.ordinal === undefined || node.address === "" ? undefined : `${node.kind}/${node.address}`);

/** 開いた節を番地ごとに積む。同じ番地の節がもう開いていれば、その一番近いものが中に自分の番号を持つ。 */
const enter = (open: Map<string, StructureNode[]>, key: string, node: StructureNode, quoting: Set<StructureNode>): void => {
  const holders = open.get(key) ?? [];
  const nearest = holders.at(-1);
  if (nearest !== undefined) quoting.add(nearest);
  holders.push(node);
  open.set(key, holders);
};

/**
 * 同じ種類・同じ番地の番号付きの節を中に持つ節。自分の中に自分は無いので、これはこの文書の番号ではなく、
 * 書き方の手本（「§ 163.25」の下に書き直した「§ 163.25」）のように、ほかの文書の条を名前として引いている。
 * 木を一度だけ歩く。一番近い祖先だけに印を付ければ、その外側は内側の祖先が付ける。深い木でも再帰しない。
 */
export const numbersQuotedInside = (tree: StructureNode): ReadonlySet<StructureNode> => {
  const quoting = new Set<StructureNode>();
  const open = new Map<string, StructureNode[]>();
  const pending: Visit[] = [{ node: tree, leaving: false }];
  for (let visit = pending.pop(); visit !== undefined; visit = pending.pop()) {
    const key = keyOf(visit.node);
    if (visit.leaving) {
      if (key !== undefined) open.get(key)?.pop();
      continue;
    }
    if (key !== undefined) enter(open, key, visit.node, quoting);
    pending.push({ node: visit.node, leaving: true });
    visit.node.children.toReversed().forEach((child) => pending.push({ node: child, leaving: false }));
  }
  return quoting;
};
