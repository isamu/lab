import type { Detector } from "../../plugin.ts";
import { varianceMismatch } from "../variance.ts";

export const detector: Detector = varianceMismatch;
