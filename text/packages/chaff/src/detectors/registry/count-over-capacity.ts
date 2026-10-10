import type { Detector } from "../../plugin.ts";
import { countOverCapacity } from "../count-over-capacity.ts";

export const detector: Detector = countOverCapacity;
