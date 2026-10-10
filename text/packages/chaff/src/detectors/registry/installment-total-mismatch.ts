import type { Detector } from "../../plugin.ts";
import { installmentTotalMismatch } from "../installment-total-mismatch.ts";

export const detector: Detector = installmentTotalMismatch;
