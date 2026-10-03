import type { Detector } from "../../plugin.ts";
import { ordinalSuffix } from "../ordinal-suffix.ts";

export const detector: Detector = ordinalSuffix;
