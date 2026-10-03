import type { Detector } from "../../plugin.ts";
import { misuseMatch } from "../misuse-match.ts";

export const detector: Detector = misuseMatch;
