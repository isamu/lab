import type { Detector } from "../plugin.ts";
import { countPerSection } from "./count-per-section.ts";
import { sentenceLength } from "./sentence-length.ts";
import { headingEcho } from "./heading-echo.ts";
import { repeatedHead } from "./repeated-head.ts";
import { sentenceRhythm } from "./sentence-rhythm.ts";
import { phraseMatch } from "./phrase-match.ts";
import { agentlessPassive } from "./agentless-passive.ts";
import { sentenceEnding } from "./sentence-ending.ts";
import { doubledParticle, nounEnding } from "./token-shape.ts";
import { kanjiRun, middleDot } from "./char-shape.ts";
import { adverbDensity, conjunctionRun, expletive, oxfordComma, titleCaseMix } from "./en-shape.ts";
import { paragraphLength, paragraphVariance, preambleLength, ruleOfThree, sectionUniformity } from "./structure.ts";
import { concreteEvidence, dashDensity, emojiDensity, ngramRepetition, undefinedAcronym } from "./signals.ts";
import { aiTell, contractionMix, cushionDensity, hedgingDensity, repeatedConjunction, unqualifiedSuperlative } from "./lexicon.ts";
import { internalJargon, properNounDensity, requiredSections } from "./team.ts";

/** rule 定義の how_to_find がここを引く。rule 側は実装を知らない。 */
export const DETECTORS: Readonly<Record<string, Detector>> = {
  "count-per-section": countPerSection,
  "sentence-length": sentenceLength,
  "heading-echo": headingEcho,
  "repeated-head": repeatedHead,
  "sentence-rhythm": sentenceRhythm,
  "phrase-match": phraseMatch,
  "agentless-passive": agentlessPassive,
  "sentence-ending": sentenceEnding,
  "noun-ending": nounEnding,
  "doubled-particle": doubledParticle,
  "kanji-run": kanjiRun,
  "middle-dot": middleDot,
  "adverb-density": adverbDensity,
  expletive: expletive,
  "conjunction-run": conjunctionRun,
  "title-case-mix": titleCaseMix,
  "oxford-comma": oxfordComma,
  "paragraph-length": paragraphLength,
  "paragraph-variance": paragraphVariance,
  "section-uniformity": sectionUniformity,
  "rule-of-three": ruleOfThree,
  "preamble-length": preambleLength,
  "emoji-density": emojiDensity,
  "dash-density": dashDensity,
  "ngram-repetition": ngramRepetition,
  "undefined-acronym": undefinedAcronym,
  "concrete-evidence": concreteEvidence,
  "hedging-density": hedgingDensity,
  "cushion-density": cushionDensity,
  "unqualified-superlative": unqualifiedSuperlative,
  "repeated-conjunction": repeatedConjunction,
  "ai-tell": aiTell,
  "contraction-mix": contractionMix,
  "internal-jargon": internalJargon,
  "required-sections": requiredSections,
  "proper-noun-density": properNounDensity,
};
