import type { Detector } from "../../plugin.ts";
import { referenceNumberRepeated } from "../reference-number-repeated.ts";

export const detector: Detector = referenceNumberRepeated;
