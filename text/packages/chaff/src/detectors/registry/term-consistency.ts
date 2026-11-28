import type { Detector } from "../../plugin.ts";
import { termConsistency } from "../term-consistency.ts";

export const detector: Detector = termConsistency;
