import type { Detector } from "../../plugin.ts";
import { ratioMismatch } from "../ratio-mismatch.ts";

export const detector: Detector = ratioMismatch;
