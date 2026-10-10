import type { Detector } from "../../plugin.ts";
import { meterUsage } from "../meter-usage.ts";

export const detector: Detector = meterUsage;
