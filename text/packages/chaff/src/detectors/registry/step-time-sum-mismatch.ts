import type { Detector } from "../../plugin.ts";
import { stepTimeSumMismatch } from "../step-time-sum.ts";

export const detector: Detector = stepTimeSumMismatch;
