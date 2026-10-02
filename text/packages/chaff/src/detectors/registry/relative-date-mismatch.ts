import type { Detector } from "../../plugin.ts";
import { relativeDateMismatch } from "../relative-dates.ts";

export const detector: Detector = relativeDateMismatch;
