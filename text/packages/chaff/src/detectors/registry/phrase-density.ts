import type { Detector } from "../../plugin.ts";
import { phraseDensity } from "../lexicon.ts";

export const detector: Detector = phraseDensity;
