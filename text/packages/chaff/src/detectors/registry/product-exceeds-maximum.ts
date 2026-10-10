import type { Detector } from "../../plugin.ts";
import { productExceedsMaximum } from "../use-maximum.ts";

export const detector: Detector = productExceedsMaximum;
