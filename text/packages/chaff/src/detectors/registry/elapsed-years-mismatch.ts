import type { Detector } from "../../plugin.ts";
import { elapsedYearsMismatch } from "../labelled-age.ts";

export const detector: Detector = elapsedYearsMismatch;
