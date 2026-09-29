import type { StructureNode } from "../plugin.ts";
import { listedTags } from "./listed-tags.ts";
import { namesAbsentUnit } from "./unit-word.ts";

// 木だけで決まる誤り。参照先が無い、番号が飛ぶ・重なる、同じ語を二度定義する。
// 意味の食い違いは判定しない。書いてあることから機械で決まるものだけを出す。

export type StructureIssue = { readonly offset: number; readonly values: Readonly<Record<string, string | number>> };

const NUMBERED: ReadonlySet<string> = new Set(["chapter", "article", "item"]);

/** 木を上から順に平らにする。文書の中での順番と同じになる。再帰にしないのは、深い木でスタックを使い切らないため。 */
export const inDocumentOrder = (tree: StructureNode): StructureNode[] => {
  const order: StructureNode[] = [];
  const pending: StructureNode[] = [tree];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    order.push(node);
    pending.push(...node.children.toReversed());
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
  addresses.has(textOf(node, "target")) || (node.attrs["fallback"] !== undefined && addresses.has(fallbackKey(node)));

/**
 * fallbackLabel があれば、fallback はその見出しの番号で書かれた節点だけに当たる。
 * 「第3章」の fallback 3 は「## 3. 構成」には当たり、同じ番地の「第3条」には当たらない。
 */
const labelled = (address: string, label: string): string => `${address}\u0000${label}`;
const fallbackKey = (node: StructureNode): string =>
  node.attrs["fallbackLabel"] === undefined ? textOf(node, "fallback") : labelled(textOf(node, "fallback"), textOf(node, "fallbackLabel"));

/** 見出しの下の章（h1/ch9）は、見出しの番地を除いた ch9 でも指せる。本文の「第9章」は見出しの番地を書かない。 */
const addressesOf = (node: StructureNode): string[] =>
  node.kind === "chapter" && node.address.includes("/") ? [node.address, node.address.slice(node.address.lastIndexOf("/") + 1)] : [node.address];

const keysOf = (node: StructureNode): string[] => addressesOf(node).flatMap((address) => [address, labelled(address, textOf(node, "label"))]);

/**
 * 他の文書を指す参照か。citedTag（"[HTTP-CACHING]"）は、書き方だけでは差し込み欄の "[BUYER-1]" と見分けられないので、
 * 文書がその語を一覧に載せているときだけ他の文書の名とみなす。
 */
const citesOtherDocument =
  (listed: ReadonlySet<string>) =>
  (node: StructureNode): boolean =>
    node.attrs["document"] !== undefined || (node.attrs["citedTag"] !== undefined && listed.has(textOf(node, "citedTag")));

const numbering = (node: StructureNode): unknown => node.attrs["numbering"];

/**
 * 参照の番地が木に無い。他の文書の名前が付いた参照（民法第709条、Section 9 of the Master Agreement）は引かない。
 * 条を 1 つも持たない文書も見ない。他の文書を指しているだけかもしれない。
 */
export const danglingReferences = (tree: StructureNode, source: string): StructureIssue[] => {
  const nodes = inDocumentOrder(tree);
  // 参照は条を指す。条を一つも持たない文書（契約書に付ける承諾書のひな形など）の「契約書第6条」は、別の文書の条。
  if (!nodes.some((node) => node.kind === "article")) return [];
  const tagged = nodes.some((node) => node.attrs["citedTag"] !== undefined);
  const citesOther = citesOtherDocument(tagged ? listedTags(source) : new Set());
  const addresses = new Set(nodes.filter((node) => NUMBERED.has(node.kind)).flatMap(keysOf));
  // Section で組んだ法令が "Articles 13 to 21 of the UK GDPR" と別の文書の Article を名指ししていれば、名の無い "Article 6(3)" もそちら。
  // 名指しがあれば、名の無い "Article 9" が書き間違いか向こうの条かは区別できないので黙る。名指しが無い文書では報告する。
  const numberings = new Set(nodes.flatMap((node) => (node.kind === "article" && node.numbering !== undefined ? [node.numbering] : [])));
  const citedElsewhere = new Set(nodes.filter((node) => node.kind === "reference" && citesOther(node)).map(numbering));
  const otherNumbering = (node: StructureNode): boolean =>
    numberings.size > 0 && typeof numbering(node) === "string" && !numberings.has(String(numbering(node))) && citedElsewhere.has(numbering(node));
  const articleLabels = nodes.filter((node) => node.kind === "article").map((node) => textOf(node, "label"));
  return nodes
    .filter((node) => node.kind === "reference" && !citesOther(node) && !otherNumbering(node))
    .filter((node) => !namesAbsentUnit(node, articleLabels))
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
    current.node.children.toReversed().forEach((child) => pending.push({ node: child, article }));
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
    const within = node.attrs["within"] === undefined ? article : textOf(node, "within");
    const key = node.attrs["scope"] === "local" ? `${within}\u0000${term}` : term;
    const earlier = first.get(key);
    if (earlier === undefined) {
      first.set(key, node);
      return [];
    }
    return [{ offset: node.span.start, values: { term, first: earlier.line } }];
  });
};
