import type { Detector } from "../../plugin.ts";
import { phraseMatch } from "../phrase-match.ts";

export const detector: Detector = phraseMatch;
