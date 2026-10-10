import type { Detector } from "../../plugin.ts";
import { bmiMismatch } from "../bmi-mismatch.ts";

export const detector: Detector = bmiMismatch;
