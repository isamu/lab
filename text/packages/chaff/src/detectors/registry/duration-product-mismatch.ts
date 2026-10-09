import type { Detector } from "../../plugin.ts";
import { durationProductMismatch } from "../derived-numbers.ts";

export const detector: Detector = durationProductMismatch;
