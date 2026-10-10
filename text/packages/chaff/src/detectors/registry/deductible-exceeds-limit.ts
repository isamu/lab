import type { Detector } from "../../plugin.ts";
import { deductibleExceedsLimit } from "../deductible-exceeds-limit.ts";

export const detector: Detector = deductibleExceedsLimit;
