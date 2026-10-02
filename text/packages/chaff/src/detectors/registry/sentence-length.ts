import type { Detector } from "../../plugin.ts";
import { sentenceLength } from "../sentence-length.ts";

export const detector: Detector = sentenceLength;
