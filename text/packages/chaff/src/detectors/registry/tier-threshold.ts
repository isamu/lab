import type { Detector } from "../../plugin.ts";
import { tierThreshold } from "../tier-threshold.ts";

export const detector: Detector = tierThreshold;
