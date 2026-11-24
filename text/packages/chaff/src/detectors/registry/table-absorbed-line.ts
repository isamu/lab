import type { Detector } from "../../plugin.ts";
import { tableAbsorbedLine } from "../markdown-slip.ts";

export const detector: Detector = tableAbsorbedLine;
