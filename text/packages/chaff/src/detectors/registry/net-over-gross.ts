import type { Detector } from "../../plugin.ts";
import { netOverGrossDetector } from "../net-gross-weight.ts";

export const detector: Detector = netOverGrossDetector;
