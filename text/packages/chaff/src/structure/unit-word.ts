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
