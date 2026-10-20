import type { StructureNode } from "../plugin.ts";

/**
 * 参照が単位の語（attrs.unitWord、日本語の「条」）で番号を名指していて、文書のどの条の番号にもその語が無い。
 * 見出しに「1 目的」と番号を振った指針の「法第2条」は、指針の 2 ではなく、その語で条を数える別の文書（法律）の条。
 * 単位の語を付けない言語・参照（英語の Section）は、ここでは決めない。
 */
export const namesAbsentUnit = (reference: StructureNode, articleLabels: readonly string[]): boolean => {
  const unitWord = reference.attrs["unitWord"];
  return typeof unitWord === "string" && unitWord !== "" && !articleLabels.some((label) => label.includes(unitWord));
};

const firstWord = (label: string): string => label.trim().split(/\s/u)[0]?.toLowerCase() ?? "";

/**
 * 参照が自分の入っているまとまり（attrs.withinUnit、"section 552 of this title" の title）を名指していて、文書の番号の付いた
 * まとまりのどれもその語で数えていない。法典の一つの条だけの文書の "this title" は法典の編で、参照先はこの文書の外にある。
 * `unitLabels` は文書の章・条の label（"Part I", "Chapter 35", "Section 3"）。
 */
export const withinAbsentUnit = (reference: StructureNode, unitLabels: readonly string[]): boolean => {
  const unit = reference.attrs["withinUnit"];
  return typeof unit === "string" && unit !== "" && !unitLabels.some((label) => firstWord(label) === unit.toLowerCase());
};
