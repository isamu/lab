import type { Detector } from "../../plugin.ts";
import { properNounDensity } from "../proper-noun-density.ts";

export const detector: Detector = properNounDensity;
