import type { Detector } from "../../plugin.ts";
import { totalMismatch } from "../structure-tree.ts";

export const detector: Detector = totalMismatch;
