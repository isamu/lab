import type { Detector } from "../../plugin.ts";
import { phraseMatchAll } from "../phrase-match-all.ts";

export const detector: Detector = phraseMatchAll;
