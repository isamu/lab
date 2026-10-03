import type { Detector } from "../../plugin.ts";
import { unrenderedEmphasis } from "../markdown-slip.ts";

export const detector: Detector = unrenderedEmphasis;
