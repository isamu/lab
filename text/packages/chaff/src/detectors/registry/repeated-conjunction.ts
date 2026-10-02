import type { Detector } from "../../plugin.ts";
import { repeatedConjunction } from "../lexicon.ts";

export const detector: Detector = repeatedConjunction;
