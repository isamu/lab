import type { Detector } from "../../plugin.ts";
import { ellipsisConsistency } from "../ellipsis.ts";

export const detector: Detector = ellipsisConsistency;
