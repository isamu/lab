import type { Detector } from "../../plugin.ts";
import { percentSumMismatch } from "../structure-tree.ts";

export const detector: Detector = percentSumMismatch;
