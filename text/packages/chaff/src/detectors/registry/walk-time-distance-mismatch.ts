import type { Detector } from "../../plugin.ts";
import { walkTimeDistanceMismatch } from "../walk-time-distance-mismatch.ts";

export const detector: Detector = walkTimeDistanceMismatch;
