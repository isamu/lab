import type { StructureNode } from "../plugin.ts";

// 木だけで決まる誤り。参照先が無い、番号が飛ぶ・重なる、同じ語を二度定義する。
// 意味の食い違いは判定しない。書いてあることから機械で決まるものだけを出す。

export type StructureIssue = { readonly offset: number; readonly values: Readonly<Record<string, string | number>> };

const NUMBERED: readonly string[] = ["chapter", "article", "item"];

/** 木を上から順に平らにする。文書の中での順番と同じになる。再帰にしないのは、深い木でスタックを使い切らないため。 */
export const inDocumentOrder = (tree: StructureNode): StructureNode[] => {
  const order: StructureNode[] = [];
  const pending: StructureNode[] = [tree];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    order.push(node);
    pending.push(...[...node.children].reverse());
  }
  return order;
};

const textOf = (node: StructureNode, key: string): string => {
  const value = node.attrs[key];
  return value === undefined ? "" : String(value);
};

/**
 * 日本語の法令は第 1 項に番号を振らない。「第4条第1項」は、第4条があり、番号付きの 4.1 が無ければ本文の第 1 項を指す。
 * 4.1 が番号付きで書かれていれば、普通の番地として引ける。
 */
const unnumberedFirst = (target: string, addresses: ReadonlySet<string>): boolean => target.endsWith(".1") && addresses.has(target.slice(0, -".1".length));

/** 参照の番地が木に無い。番号付きのまとまりを 1 つも持たない文書は、他の文書を指しているだけかもしれないので見ない。 */
export const danglingReferences = (tree: StructureNode): StructureIssue[] => {
  const nodes = inDocumentOrder(tree);
  const addresses = new Set(nodes.filter((node) => NUMBERED.includes(node.kind)).map((node) => node.address));
  if (addresses.size === 0) return [];
  return nodes
    .filter((node) => node.kind === "reference")
    .filter((node) => !addresses.has(textOf(node, "target")) && !unnumberedFirst(textOf(node, "target"), addresses))
    .map((node) => ({ offset: node.span.start, values: { label: textOf(node, "label"), target: textOf(node, "target") } }));
};

/** 同じ語の二度目以降の定義。どちらが正しいかは決めず、両方の場所を示す。 */
export const duplicateDefinitions = (tree: StructureNode): StructureIssue[] => {
  const first = new Map<string, StructureNode>();
  return inDocumentOrder(tree)
    .filter((node) => node.kind === "definition")
    .flatMap((node) => {
      const term = textOf(node, "term");
      const earlier = first.get(term);
      if (earlier === undefined) {
        first.set(term, node);
        return [];
      }
      return [{ offset: node.span.start, values: { term, first: earlier.line } }];
    });
};
