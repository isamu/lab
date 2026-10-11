import type { Detector } from "../../plugin.ts";
import { backorderMismatchDetector } from "../order-quantity.ts";

export const detector: Detector = backorderMismatchDetector;
