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
};
