import type { Detector } from "../../plugin.ts";
import { cumulativeBelow } from "../cumulative-below-current.ts";

export const detector: Detector = cumulativeBelow;
