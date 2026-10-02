import type { Detector } from "../../plugin.ts";
import { headingLevelSkip } from "../heading-level-skip.ts";

export const detector: Detector = headingLevelSkip;
