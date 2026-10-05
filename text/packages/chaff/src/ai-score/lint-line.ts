import type { SourceCheck } from "../check-source.ts";
import { aiScoreOfDocument } from "./of-document.ts";
import { aiScoreSummaryLine } from "./render.ts";
import { scoreViewOf } from "./view.ts";

/** The quick score's one line under a file's lint report, read from the document lint already built. */
export const aiScoreLineOf = (check: SourceCheck): string => {
  const score = aiScoreOfDocument(check.doc, check.rules, check.genre.genre);
  return aiScoreSummaryLine(score, check.doc.path, scoreViewOf(check.language, check.doc.lengthUnit, score.group, check.rules));
};
