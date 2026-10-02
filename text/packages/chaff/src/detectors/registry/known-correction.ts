import type { Detector } from "../../plugin.ts";
import { knownCorrection } from "../known-correction.ts";

export const detector: Detector = knownCorrection;
