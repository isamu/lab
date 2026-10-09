import type { Detector } from "../../plugin.ts";
import { annualPayMismatch } from "../annual-pay-mismatch.ts";

export const detector: Detector = annualPayMismatch;
