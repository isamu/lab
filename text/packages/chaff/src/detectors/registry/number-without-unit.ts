import type { Detector } from "../../plugin.ts";
import { numberWithoutUnit } from "../number-unit.ts";

export const detector: Detector = numberWithoutUnit;
