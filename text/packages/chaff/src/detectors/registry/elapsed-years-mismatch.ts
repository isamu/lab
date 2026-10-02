import type { Detector } from "../../plugin.ts";
import { elapsedYearsMismatch } from "../derived-numbers.ts";

export const detector: Detector = elapsedYearsMismatch;
