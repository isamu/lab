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
 * 参照がこの文書のどこかを指しているか。fallback は言語パッケージが付ける別の行き先で、
 * 日本語の「第4条第1項」は、番号の無い第 1 項を持つ第4条を指しうる。
 */
const resolves = (node: StructureNode, addresses: ReadonlySet<string>): boolean =>
  addresses.has(textOf(node, "target")) || (node.attrs["fallback"] !== undefined && addresses.has(textOf(node, "fallback")));

/**
 * 参照の番地が木に無い。他の文書の名前が付いた参照（民法第709条、Section 9 of the Master Agreement）は引かない。
 * 番号付きのまとまりを 1 つも持たない文書も見ない。他の文書を指しているだけかもしれない。
 */
export const danglingReferences = (tree: StructureNode): StructureIssue[] => {
  const nodes = inDocumentOrder(tree);
  const addresses = new Set(nodes.filter((node) => NUMBERED.includes(node.kind)).map((node) => node.address));
  if (addresses.size === 0) return [];
  return nodes
    .filter((node) => node.kind === "reference" && node.attrs["document"] === undefined)
    .filter((node) => !resolves(node, addresses))
    .map((node) => ({ offset: node.span.start, values: { label: textOf(node, "label"), target: textOf(node, "target") } }));
};

/** 同じ語の二度目以降の定義。どちらが正しいかは決めず、両方の場所を示す。 */
export const duplicateDefinitions = (tree: StructureNode): StructureIssue[] => {
  const first = new Map<string, StructureNode>();
  return (
    inDocumentOrder(tree)
      // 範囲を限った定義（この条において「X」とは）は、別の条での定義し直しが正しい書き方。
      .filter((node) => node.kind === "definition" && node.attrs["scope"] !== "local")
      .flatMap((node) => {
        const term = textOf(node, "term");
        const earlier = first.get(term);
        if (earlier === undefined) {
          first.set(term, node);
          return [];
        }
        return [{ offset: node.span.start, values: { term, first: earlier.line } }];
      })
  );
};
