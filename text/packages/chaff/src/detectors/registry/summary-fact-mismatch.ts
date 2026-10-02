import type { Detector } from "../../plugin.ts";
import { summaryFactMismatch } from "../fact-consistency.ts";

export const detector: Detector = summaryFactMismatch;
