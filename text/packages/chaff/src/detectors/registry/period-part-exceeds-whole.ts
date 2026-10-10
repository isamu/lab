import type { Detector } from "../../plugin.ts";
import { periodPartExceedsWhole } from "../period-part.ts";

export const detector: Detector = periodPartExceedsWhole;
