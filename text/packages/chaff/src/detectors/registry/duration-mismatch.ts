import type { Detector } from "../../plugin.ts";
import { durationMismatch } from "../derived-numbers.ts";

export const detector: Detector = durationMismatch;
