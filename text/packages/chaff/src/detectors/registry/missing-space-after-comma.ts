import type { Detector } from "../../plugin.ts";
import { missingSpaceAfterComma } from "../missing-space-after-comma.ts";

export const detector: Detector = missingSpaceAfterComma;
