import type { CrossDetector } from "../../plugin.ts";
import { crossDocTermVariant } from "../cross-variant.ts";

export const detector: CrossDetector = crossDocTermVariant;
