import type { Detector } from "../plugin.ts";
import { countPerSection } from "./count-per-section.ts";
import { sentenceLength } from "./sentence-length.ts";
import { headingEcho } from "./heading-echo.ts";
import { repeatedHead } from "./repeated-head.ts";
import { sentenceRhythm } from "./sentence-rhythm.ts";
import { phraseCount, phraseMatch } from "./phrase-match.ts";
import { agentlessPassive } from "./agentless-passive.ts";
import { doubledWord } from "./doubled-word.ts";
import { agreementSlip } from "./agreement-slip.ts";
import { sentenceEnding } from "./sentence-ending.ts";
import { doubledParticle, nounEnding } from "./token-shape.ts";
import { kanjiRun, middleDot } from "./char-shape.ts";
import { adverbDensity, conjunctionRun, expletive, titleCaseMix } from "./en-shape.ts";
import { oxfordComma } from "./oxford-comma.ts";
import { paragraphLength, paragraphVariance, preambleLength, ruleOfThree, sectionUniformity } from "./structure.ts";
import { concreteEvidence, dashDensity, emojiDensity, ngramRepetition, undefinedAcronym } from "./signals.ts";
import { aiTell, contractionMix, cushionDensity, hedging, repeatedConjunction, unqualifiedSuperlative } from "./lexicon.ts";
import { internalJargon, properNounDensity, requiredSections } from "./team.ts";
import { latinSpacing, preferredTerm } from "./orthography.ts";
import { straySpace } from "./stray-space.ts";
import { announcedCount } from "./announced-count.ts";
import { danglingFigure } from "./dangling-figure.ts";
import {
  danglingReference,
  dateOrder,
  dateRangeReversed,
  dateWeekdayMismatch,
  duplicateDefinition,
  numberingGap,
  percentSumMismatch,
  totalMismatch,
} from "./structure-tree.ts";
import { katakanaLongVowel } from "./long-vowel.ts";
import { assistantResidue, contrastFraming, stockTransition, unfilledPlaceholder } from "./ai-phrasing.ts";

/** rule 定義の how_to_find がここを引く。rule 側は実装を知らない。 */
export const DETECTORS: Readonly<Record<string, Detector>> = {
  "count-per-section": countPerSection,
  "sentence-length": sentenceLength,
  "heading-echo": headingEcho,
  "repeated-head": repeatedHead,
  "sentence-rhythm": sentenceRhythm,
  "phrase-match": phraseMatch,
  "phrase-count": phraseCount,
  "agentless-passive": agentlessPassive,
  "sentence-ending": sentenceEnding,
  "noun-ending": nounEnding,
  "doubled-particle": doubledParticle,
  "doubled-word": doubledWord,
  "agreement-slip": agreementSlip,
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
  hedging: hedging,
  "cushion-density": cushionDensity,
  "unqualified-superlative": unqualifiedSuperlative,
  "repeated-conjunction": repeatedConjunction,
  "ai-tell": aiTell,
  "contrast-framing": contrastFraming,
  "stock-transition": stockTransition,
  "assistant-residue": assistantResidue,
  "unfilled-placeholder": unfilledPlaceholder,
  "contraction-mix": contractionMix,
  "internal-jargon": internalJargon,
  "required-sections": requiredSections,
  "proper-noun-density": properNounDensity,
  "preferred-term": preferredTerm,
  "latin-spacing": latinSpacing,
  "stray-space": straySpace,
  "katakana-long-vowel": katakanaLongVowel,
  "dangling-reference": danglingReference,
  "date-weekday-mismatch": dateWeekdayMismatch,
  "date-order": dateOrder,
  "total-mismatch": totalMismatch,
  "numbering-gap": numberingGap,
  "duplicate-definition": duplicateDefinition,
  "announced-count": announcedCount,
  "dangling-figure": danglingFigure,
  "date-range-reversed": dateRangeReversed,
  "percent-sum-mismatch": percentSumMismatch,
};
