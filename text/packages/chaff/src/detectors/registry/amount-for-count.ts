import type { Detector } from "../../plugin.ts";
import { amountForCount } from "../amount-for-count.ts";

export const detector: Detector = amountForCount;
