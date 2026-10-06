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
const resolves = (node: StructureNode, addresses: ReadonlySet<string>, chapters: Chapters): boolean =>
  addresses.has(textOf(node, "target")) ||
  (node.attrs["fallback"] !== undefined && chapterReading(textOf(node, "target"), chapters).fallback && addresses.has(fallbackKey(node)));

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

/** An address without its numbers: the kind of unit it names (ch9 and ch10 are both ch). */
const unitOf = (address: string): string => address.replaceAll(/[\d.]+/gu, "");

/** The document's chapters: their addresses, and whether the one chapter is the document itself (its title, first of all). */
export type Chapters = { readonly addresses: readonly string[]; readonly titled: boolean };

/**
 * How a document's chapters bear on a reference to a chapter (第9章, Chapter 9). Pure.
 *   fallback: whether the reference may fall back to a numbered section ("## 9. …"). Only in a document with no chapter:
 *     where chapters are written, a chapter reference names a chapter, and section 9 is not chapter 9.
 *   elsewhere: the reference names a chapter of another file. A document that is one chapter (第10章 as its title, a series
 *     of one chapter per file) holds no other chapter, so 第9章 is the next file's. Its own chapter is still its own.
 */
export const chapterReading = (target: string, chapters: Chapters): { readonly fallback: boolean; readonly elsewhere: boolean } => {
  const shortAddresses = chapters.addresses.map((address) => address.slice(address.lastIndexOf("/") + 1));
  const toChapter = new Set(shortAddresses.map(unitOf)).has(unitOf(target));
  const series = chapters.titled && chapters.addresses.length === 1 && !shortAddresses.includes(target);
  return { fallback: !toChapter, elsewhere: toChapter && series };
};

/** A chapter is the document's title when it is not under another heading (ch10, not h1/ch1) and nothing numbered comes before it. */
const chaptersOf = (nodes: readonly StructureNode[]): Chapters => {
  const chapters = nodes.filter((node) => node.kind === "chapter");
  const first = nodes.find((node) => NUMBERED.has(node.kind));
  const titled = chapters.length === 1 && first === chapters[0] && !(first?.address.includes("/") ?? true);
  return { addresses: chapters.map((node) => node.address), titled };
};

/** What may stand between a chapter and the reference it qualifies: nothing (第1章第2条) or の (第1章の第2条). A list mark (第1章、第2条) names two. */
const QUALIFIER_GAPS: ReadonlySet<string> = new Set(["", "の"]);

/**
 * The references that point into another file: a chapter reference read as elsewhere (chapterReading), and the reference
 * right after one, which it qualifies (第1章の第2条 is article 2 of that other chapter).
 */
const elsewhereReferences = (nodes: readonly StructureNode[], source: string): ReadonlySet<StructureNode> => {
  const chapters = chaptersOf(nodes);
  const references = nodes.filter((node) => node.kind === "reference");
  const elsewhere = new Set<StructureNode>();
  references.forEach((node, index) => {
    const before = references[index - 1];
    const qualified = before !== undefined && elsewhere.has(before) && QUALIFIER_GAPS.has(source.slice(before.span.end, node.span.start).trim());
    if (qualified || chapterReading(textOf(node, "target"), chapters).elsewhere) elsewhere.add(node);
  });
  return elsewhere;
};

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
  const chapters = chaptersOf(nodes);
  const elsewhere = elsewhereReferences(nodes, source);
  return nodes
    .filter((node) => node.kind === "reference" && !citesOther(node) && !otherNumbering(node))
    .filter((node) => !namesAbsentUnit(node, articleLabels) && !elsewhere.has(node))
    .filter((node) => !resolves(node, addresses, chapters))
    .map((node) => ({ offset: node.span.start, values: { label: textOf(node, "label"), target: textOf(node, "target") } }));
};

/**
 * 参照が指す節点。danglingReferences と同じ引き方（番地、章の短い番地、fallback）で、番号の付いたまとまりを引く。
 * 同じ鍵の節点が二つ以上ある（番号の振り直しや別表の条）ときは、どれを指すのか決まらないので undefined。
 */
export const referenceResolver = (tree: StructureNode, source: string): ((reference: StructureNode) => StructureNode | undefined) => {
  const nodes = inDocumentOrder(tree);
  const chapters = chaptersOf(nodes);
  const elsewhere = elsewhereReferences(nodes, source);
  const byKey = new Map<string, StructureNode | null>();
  inDocumentOrder(tree)
    .filter((node) => NUMBERED.has(node.kind))
    .forEach((node) => keysOf(node).forEach((key) => byKey.set(key, byKey.has(key) && byKey.get(key) !== node ? null : node)));
  const resolve = (reference: StructureNode): StructureNode | undefined => {
    if (elsewhere.has(reference)) return undefined;
    const target = byKey.get(textOf(reference, "target"));
    if (target !== undefined) return target ?? undefined;
    const fallback = reference.attrs["fallback"] !== undefined && chapterReading(textOf(reference, "target"), chapters).fallback;
    return fallback ? (byKey.get(fallbackKey(reference)) ?? undefined) : undefined;
  };
  // Article 6 は Section 6 ではない。番号の書き方が両方にあって違えば、別の文書の条かもしれないので引かない。
  return (reference) => {
    const target = resolve(reference);
    const written = numbering(reference);
    return target === undefined || typeof written !== "string" || target.numbering === undefined || target.numbering === written ? target : undefined;
  };
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
