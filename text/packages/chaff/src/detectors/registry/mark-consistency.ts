import type { Detector } from "../../plugin.ts";
import { markConsistency } from "../mark-shape.ts";

export const detector: Detector = markConsistency;
