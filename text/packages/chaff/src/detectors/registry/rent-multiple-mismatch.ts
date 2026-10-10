import type { Detector } from "../../plugin.ts";
import { rentMultipleMismatch } from "../rent-multiple-mismatch.ts";

export const detector: Detector = rentMultipleMismatch;
