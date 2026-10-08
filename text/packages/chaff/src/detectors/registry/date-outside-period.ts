import type { Detector } from "../../plugin.ts";
import { dateOutsidePeriod } from "../date-outside-period.ts";

export const detector: Detector = dateOutsidePeriod;
