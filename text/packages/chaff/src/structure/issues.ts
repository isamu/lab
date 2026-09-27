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
 * 条を 1 つも持たない文書も見ない。他の文書を指しているだけかもしれない。
 */
export const danglingReferences = (tree: StructureNode): StructureIssue[] => {
  const nodes = inDocumentOrder(tree);
  // 参照は条を指す。条を一つも持たない文書（契約書に付ける承諾書のひな形など）の「契約書第6条」は、別の文書の条。
  if (!nodes.some((node) => node.kind === "article")) return [];
  const addresses = new Set(nodes.filter((node) => NUMBERED.includes(node.kind)).map((node) => node.address));
  // Section で組んだ法令が "Articles 13 to 21 of the UK GDPR" と別の文書の Article を名指ししていれば、名の無い "Article 6(3)" もそちら。
  // 名指しがあれば、名の無い "Article 9" が書き間違いか向こうの条かは区別できないので黙る。名指しが無い文書では報告する。
  const numbering = (node: StructureNode): unknown => node.attrs["numbering"];
  const numberings = new Set(nodes.flatMap((node) => (node.kind === "article" && node.numbering !== undefined ? [node.numbering] : [])));
  const citedElsewhere = new Set(nodes.filter((node) => node.kind === "reference" && node.attrs["document"] !== undefined).map(numbering));
  const otherNumbering = (node: StructureNode): boolean =>
    numberings.size > 0 && typeof numbering(node) === "string" && !numberings.has(String(numbering(node))) && citedElsewhere.has(numbering(node));
  return nodes
    .filter((node) => node.kind === "reference" && node.attrs["document"] === undefined && !otherNumbering(node))
    .filter((node) => !resolves(node, addresses))
    .map((node) => ({ offset: node.span.start, values: { label: textOf(node, "label"), target: textOf(node, "target") } }));
};

type Definition = { readonly node: StructureNode; readonly article: string };

/** 定義を文書の順に、それが置かれた条の番地と一緒に並べる。範囲を限った定義は、その条の中でだけ比べるため。 */
const definitionsInOrder = (tree: StructureNode): Definition[] => {
  const found: Definition[] = [];
  const pending: Definition[] = [{ node: tree, article: "" }];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    if (current.node.kind === "definition") found.push(current);
    const article = current.node.kind === "article" ? current.node.address : current.article;
    [...current.node.children].reverse().forEach((child) => pending.push({ node: child, article }));
  }
  return found;
};

/**
 * 同じ語の二度目以降の定義。どちらが正しいかは決めず、両方の場所を示す。
 * 範囲を限った定義（この条において「X」とは）は、同じ条の中でだけ比べる。別の条で定義し直すのは正しい書き方。
 */
export const duplicateDefinitions = (tree: StructureNode): StructureIssue[] => {
  const first = new Map<string, StructureNode>();
  return definitionsInOrder(tree).flatMap(({ node, article }) => {
    const term = textOf(node, "term");
    const key = node.attrs["scope"] === "local" ? `${article}\u0000${term}` : term;
    const earlier = first.get(key);
    if (earlier === undefined) {
      first.set(key, node);
      return [];
    }
    return [{ offset: node.span.start, values: { term, first: earlier.line } }];
  });
};
