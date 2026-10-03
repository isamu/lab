import type { Detector } from "../../plugin.ts";
import { unpairedParallel } from "../clause-shape.ts";

export const detector: Detector = unpairedParallel;
