import type { Detector } from "../../plugin.ts";
import { scaledQuantityMismatch } from "../scaled-quantity.ts";

export const detector: Detector = scaledQuantityMismatch;
