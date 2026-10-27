import type { StructureNode } from "../plugin.ts";

// 他の文書を引き写した節。「##### 地方公務員法」の下に引いた第十六条の「第六十条」は、地方公務員法の条で、この文書の条ではない。

/** heading: いちばん近い見出しの節の言葉。inArticle: 条の中か。 */
type Visit = { readonly node: StructureNode; readonly heading: string | undefined; readonly inArticle: boolean };

/** 見出しが名前の後ろに添えた略称や注記（「…特例に関する法律（特例法）」「…手数料令（手数料令）＜抜粋＞」）の括弧。名前ではない。 */
const GLOSS_OPENERS: Readonly<Record<string, string>> = { "）": "（", ")": "(", "＞": "＜", ">": "<" };
const MAX_GLOSS_LENGTH = 30;

/** 末尾の括弧書きを外から一つずつ外す。中に同じ括弧を含むものは外さない。 */
const withoutGlosses = (heading: string): string => {
  let name = heading.trim();
  for (;;) {
    const opener = GLOSS_OPENERS[name.at(-1) ?? ""];
    const at = opener === undefined ? -1 : name.lastIndexOf(opener);
    if (at <= 0 || name.length - at > MAX_GLOSS_LENGTH) return name;
    name = name.slice(0, at).trimEnd();
  }
};

/** 見出しの言葉。文書の最初の見出しは文書自身の題（「# 就業規則」）なので、他の文書の名前として読まない。 */
const headingOf = (node: StructureNode, title: StructureNode | undefined): string | undefined =>
  node === title ? undefined : withoutGlosses(String(node.attrs["heading"] ?? ""));

const documentsCited = (nodes: readonly StructureNode[]): ReadonlySet<string> =>
  new Set(nodes.flatMap((node) => (node.kind === "reference" && typeof node.attrs["document"] === "string" ? [node.attrs["document"]] : [])));

/** 木を上から順に、見出しの言葉と条の中かと一緒に並べる。再帰にしないのは、深い木でスタックを使い切らないため。 */
const visitsOf = (tree: StructureNode): Visit[] => {
  const title = tree.children.find((child) => child.kind === "section");
  const visits: Visit[] = [];
  const pending: Visit[] = [{ node: tree, heading: undefined, inArticle: false }];
  while (pending.length > 0) {
    const visit = pending.pop();
    if (visit === undefined) break;
    visits.push(visit);
    const { node } = visit;
    const heading = node.kind === "section" ? headingOf(node, title) : visit.heading;
    const inArticle = node.kind === "section" ? false : visit.inArticle || node.kind === "article";
    node.children.toReversed().forEach((child) => pending.push({ node: child, heading, inArticle }));
  }
  return visits;
};

/**
 * 見出しが他の文書の名前そのものである節に引き写した条の中の参照。その名前を文書がほかで他の文書として引いている
 * （「地方公務員法第16条」）ときだけ、節はその文書を引き写したものと読む。条の外の地の文の参照は、この文書のもの。Pure.
 */
export const referencesInCitedDocuments = (tree: StructureNode): ReadonlySet<StructureNode> => {
  const visits = visitsOf(tree);
  const cited = documentsCited(visits.map((visit) => visit.node));
  if (cited.size === 0) return new Set();
  const quoted = visits.filter((visit) => visit.node.kind === "reference" && visit.inArticle && visit.heading !== undefined && cited.has(visit.heading));
  return new Set(quoted.map((visit) => visit.node));
};
