import type { Detector } from "../../plugin.ts";
import { deliveredOverOrderedDetector } from "../order-quantity.ts";

export const detector: Detector = deliveredOverOrderedDetector;
