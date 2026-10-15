import type { StructureNode } from "../plugin.ts";
import { headingRegions, parentAndLabels, writtenHeadings, writtenSubdivisions, type WrittenHeading } from "./written-headings.ts";

// 木が番地にしない平文の見出しと、本文の中に書いた括弧の小見出し（「6.1 … that (i) the Software …」）を、参照の行き先として引く。

type Region = readonly [number, number];

/** addresses: 平文で書かれた見出しの番地。subdivision: 参照の札が、親の範囲の本文に書かれているか。 */
export type WrittenReading = { readonly addresses: readonly string[]; readonly subdivision: (reference: StructureNode) => boolean };

const targetOf = (node: StructureNode): string => String(node.attrs["target"] ?? "");

/**
 * 括弧の小見出しを読む範囲。木の条は、項や号を一つも読まなかったときだけ、その条の始まりから次の平文の見出しまで。
 * 項や号を読んでいれば、無い札は本当に無い。
 */
const treeRegions = (nodes: readonly StructureNode[], headings: readonly WrittenHeading[]): Map<string, Region[]> => {
  const regions = new Map<string, Region[]>();
  // 条も見出しも文書の順なので、次の見出しは前へ進めるだけで見つかる。
  let next = 0;
  nodes
    .filter((node) => node.kind === "article" && !node.children.some((child) => child.kind === "item"))
    .toSorted((left, right) => left.span.start - right.span.start)
    .forEach((node) => {
      while ((headings[next]?.start ?? Infinity) <= node.span.start) next += 1;
      const end = Math.min(headings[next]?.start ?? node.span.end, node.span.end);
      const found = regions.get(node.address) ?? [];
      found.push([node.span.start, end]);
      regions.set(node.address, found);
    });
  return regions;
};

/**
 * 平文の見出しの番地と、参照（Section 6.1(i)）の親（6.1）が木の条か平文の見出しとしてあり、その範囲の本文に札「(i)」が
 * 書かれているかを引く関数。範囲ごとの札は、要るときに一度だけ読む。Pure.
 */
export const writtenReading = (nodes: readonly StructureNode[], source: string): WrittenReading => {
  const references = nodes.filter((node) => node.kind === "reference").map((node) => ({ start: node.span.start, end: node.span.end, target: targetOf(node) }));
  const headings = writtenHeadings(references, source);
  const written = headingRegions(headings, source.length);
  const tree = treeRegions(nodes, headings);
  const labels = new Map<string, ReadonlySet<string>>();
  const labelsIn = ([start, end]: Region): ReadonlySet<string> => {
    const key = `${String(start)}:${String(end)}`;
    const found = labels.get(key) ?? writtenSubdivisions(source.slice(start, end));
    labels.set(key, found);
    return found;
  };
  const regionsOf = (address: string): Region[] => [...(tree.get(address) ?? []), ...(written.get(address) ?? [])];
  const subdivision = (reference: StructureNode): boolean => {
    const wanted = parentAndLabels(targetOf(reference), String(reference.attrs["label"] ?? ""));
    if (wanted === undefined) return false;
    return regionsOf(wanted.parent).some((region) => wanted.labels.every((label) => labelsIn(region).has(label)));
  };
  return { addresses: headings.map((heading) => heading.address), subdivision };
};
