import type { Detector } from "../../plugin.ts";
import { annualHolidaysMismatch } from "../annual-holidays-mismatch.ts";

export const detector: Detector = annualHolidaysMismatch;
