import type { Detector } from "../../plugin.ts";
import { phraseCount } from "../phrase-match.ts";

export const detector: Detector = phraseCount;
