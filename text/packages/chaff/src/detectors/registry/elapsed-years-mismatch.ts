import type { Detector } from "../../plugin.ts";
import { documentYearFindings } from "../derived-numbers.ts";
import { decidedAgeStarts, labelledAgeFindings } from "../labelled-age.ts";

/** 起点の年から数えた年数が文書の日付と合わない。生年月日の横の年齢が、受診日などの満年齢と合わない。 */
export const detector: Detector = (doc) => {
  const tree = doc.structure;
  if (tree === undefined) return [];
  const decided = decidedAgeStarts(doc, tree);
  const byDocumentYear = documentYearFindings(doc, tree).filter((finding) => !decided.has(Number(finding.values?.["offset"])));
  return [...labelledAgeFindings(doc, tree), ...byDocumentYear];
};
