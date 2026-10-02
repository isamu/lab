import type { Detector } from "../../plugin.ts";
import { sentenceEnding } from "../sentence-ending.ts";

export const detector: Detector = sentenceEnding;
