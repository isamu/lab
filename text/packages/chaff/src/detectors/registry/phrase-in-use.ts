import type { Detector } from "../../plugin.ts";
import { phraseInUse } from "../phrase-match.ts";

export const detector: Detector = phraseInUse;
