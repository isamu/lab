import type { Detector } from "../../plugin.ts";
import { sentenceCommaCount } from "../sentence-counts.ts";

export const detector: Detector = sentenceCommaCount;
