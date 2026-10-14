import type { Detector } from "../../plugin.ts";
import { unfilledPlaceholderOutsideTemplates } from "../unfilled-placeholder.ts";

export const detector: Detector = unfilledPlaceholderOutsideTemplates;
