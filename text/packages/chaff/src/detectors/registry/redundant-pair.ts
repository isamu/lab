import type { Detector } from "../../plugin.ts";
import { redundantPair } from "../redundant-pair.ts";

export const detector: Detector = redundantPair;
