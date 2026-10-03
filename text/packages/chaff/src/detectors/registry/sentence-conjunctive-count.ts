import type { Detector } from "../../plugin.ts";
import { sentenceConjunctiveCount } from "../sentence-counts.ts";

export const detector: Detector = sentenceConjunctiveCount;
