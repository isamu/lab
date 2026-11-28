import type { Detector } from "../../plugin.ts";
import { coldOpen } from "../cold-open.ts";

export const detector: Detector = coldOpen;
