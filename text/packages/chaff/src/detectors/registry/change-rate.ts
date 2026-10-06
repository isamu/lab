import type { Detector } from "../../plugin.ts";
import { changeRate } from "../change-rate.ts";

export const detector: Detector = changeRate;
