import type { Detector } from "../../plugin.ts";
import { gpaMismatch } from "../gpa-mismatch.ts";

export const detector: Detector = gpaMismatch;
