import type { Detector } from "../../plugin.ts";
import { periodLabelConflict } from "../period-label-conflict.ts";

export const detector: Detector = periodLabelConflict;
