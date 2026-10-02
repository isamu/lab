import type { Detector } from "../../plugin.ts";
import { sentenceWordCount } from "../sentence-counts.ts";

export const detector: Detector = sentenceWordCount;
