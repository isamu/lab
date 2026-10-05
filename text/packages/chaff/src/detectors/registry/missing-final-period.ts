import type { Detector } from "../../plugin.ts";
import { missingFinalPeriod } from "../missing-final-period.ts";

export const detector: Detector = missingFinalPeriod;
