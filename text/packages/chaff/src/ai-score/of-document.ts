import type { ProseDocument, RuleDefinition } from "../plugin.ts";
import { presetLevels } from "../genre-load.ts";
import { runRulesWith } from "../run.ts";
import { standingIn } from "../rule-genres.ts";
import { wordsOf } from "../detectors/structure.ts";
import { MIN_DOCUMENT_LENGTH } from "../detectors/signals.ts";
import { structureOf } from "../structure-shape/of-document.ts";
import { HUMAN_SHARES } from "./human-shares.ts";
import { aiScoreOf, type AiScore, type SignalRun } from "./score.ts";
import { measuredLevelsOf, scoredSignalIds } from "./signals.ts";

const STRUCTURE_RULE = "ai-structure";

/** The genre group a genre's human shares are measured under: business for business/report. */
export const genreGroupOf = (genre: string): string => genre.split("/")[0] ?? genre;

/** The structure baseline is human articles: it is compared only in the genres ai-structure runs in. */
const structureApplies = (rules: readonly RuleDefinition[], genre: string): boolean => {
  const rule = rules.find((entry) => entry.id === STRUCTURE_RULE);
  return rule !== undefined && standingIn(rule, genre, presetLevels(genre)).kind === "on";
};

/** The AI-shape rules run on the document at the levels the human shares were measured at, whatever chaff.yaml sets. */
const signalRuns = (doc: ProseDocument, rules: readonly RuleDefinition[], genre: string): SignalRun[] => {
  const ofLanguage = rules.filter((rule) => rule.languages === undefined || rule.languages.includes(doc.language));
  const ids = scoredSignalIds(ofLanguage);
  const signalRules = ofLanguage.filter((rule) => ids.includes(rule.id));
  const result = runRulesWith(doc, signalRules, { settings: measuredLevelsOf(signalRules, presetLevels(genre)), experimental: true, genre });
  return ids.map((rule) => {
    const notRun = result.skipped.find((skip) => skip.rule === rule)?.why;
    const count = result.findings.filter((finding) => finding.rule === rule).length;
    return notRun === undefined ? { rule, count } : { rule, count, notRun };
  });
};

/** The quick score of a document read as lint reads it, against human documents of its genre group. */
export const aiScoreOfDocument = (doc: ProseDocument, rules: readonly RuleDefinition[], genre: string): AiScore =>
  aiScoreOf({
    group: genreGroupOf(genre),
    length: wordsOf(doc),
    minimum: MIN_DOCUMENT_LENGTH[doc.lengthUnit],
    unit: doc.lengthUnit,
    signals: signalRuns(doc, rules, genre),
    shares: HUMAN_SHARES,
    structure: structureApplies(rules, genre) ? structureOf(doc) : undefined,
  });
