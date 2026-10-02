import type { Detector } from "../../plugin.ts";
import { nounEnding } from "../token-shape.ts";

export const detector: Detector = nounEnding;
