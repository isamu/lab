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
import { nominalization } from "./nominalization.ts";
import { requirementSmell } from "./requirement-smell.ts";
import { requirementModal } from "./requirement-modal.ts";
import { vagueFigurePointer } from "./vague-figure-pointer.ts";
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
import { headingLevelSkip } from "./heading-level-skip.ts";
import { referenceTitleMismatch, referenceTopicMissing } from "./reference-text.ts";
import { imageAltText } from "./image-alt-text.ts";
import { brokenLink } from "./broken-link.ts";
import { urlRunOn } from "./url-run-on.ts";
import { unbalancedBracket } from "./unbalanced-bracket.ts";
import { doubledPunctuation } from "./doubled-punctuation.ts";
import { kutotenConsistency } from "./kutoten-consistency.ts";
import { hankakuKana } from "./hankaku-kana.ts";
import { invisibleCharacter } from "./invisible-character.ts";
import { spaceBeforePunctuation } from "./space-before-punctuation.ts";
import { duplicateHeading } from "./duplicate-heading.ts";
import { emptySection } from "./empty-section.ts";
import { fullwidthAlnum } from "./fullwidth-alnum.ts";
import { spellingVariety } from "./spelling-variety.ts";
import { raNuki } from "./ra-nuki.ts";
import { katakanaLongVowel } from "./long-vowel.ts";
import { customPattern, customTokens, customWords } from "./custom.ts";
import { boldLabelList } from "./bold-label.ts";
import { assistantResidue, colonLeadIn, contrastFraming, openerDensity, openerPile, unfilledPlaceholder } from "./ai-phrasing.ts";

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
  "stock-transition": openerDensity,
  "opener-pile": openerPile,
  "colon-lead-in": colonLeadIn,
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
  "custom-words": customWords,
  "custom-pattern": customPattern,
  "custom-tokens": customTokens,
  "dangling-reference": danglingReference,
  "date-weekday-mismatch": dateWeekdayMismatch,
  "date-order": dateOrder,
  "total-mismatch": totalMismatch,
  "numbering-gap": numberingGap,
  "duplicate-definition": duplicateDefinition,
  "announced-count": announcedCount,
  "dangling-figure": danglingFigure,
  nominalization: nominalization,
  "requirement-smell": requirementSmell,
  "requirement-modal": requirementModal,
  "vague-figure-pointer": vagueFigurePointer,
  "date-range-reversed": dateRangeReversed,
  "percent-sum-mismatch": percentSumMismatch,
  "heading-level-skip": headingLevelSkip,
  "image-alt-text": imageAltText,
  "broken-link": brokenLink,
  "url-run-on": urlRunOn,
  "unbalanced-bracket": unbalancedBracket,
  "doubled-punctuation": doubledPunctuation,
  "kutoten-consistency": kutotenConsistency,
  "hankaku-kana": hankakuKana,
  "invisible-character": invisibleCharacter,
  "space-before-punctuation": spaceBeforePunctuation,
  "duplicate-heading": duplicateHeading,
  "empty-section": emptySection,
  "fullwidth-alnum": fullwidthAlnum,
  "spelling-variety": spellingVariety,
  "ra-nuki": raNuki,
  "bold-label-list": boldLabelList,
  "reference-title-mismatch": referenceTitleMismatch,
  "reference-topic-missing": referenceTopicMissing,
};
