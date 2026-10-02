import type { Detector } from "../../plugin.ts";
import { doubledPunctuation } from "../doubled-punctuation.ts";

export const detector: Detector = doubledPunctuation;
