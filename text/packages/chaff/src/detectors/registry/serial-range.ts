import type { Detector } from "../../plugin.ts";
import { serialRange } from "../serial-range.ts";

export const detector: Detector = serialRange;
