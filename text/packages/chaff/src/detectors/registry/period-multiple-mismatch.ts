import type { Detector } from "../../plugin.ts";
import { periodMultipleMismatch } from "../period-multiple-mismatch.ts";

export const detector: Detector = periodMultipleMismatch;
