import type { Detector } from "../../plugin.ts";
import { timeRangeReversed } from "../time-order.ts";

export const detector: Detector = timeRangeReversed;
