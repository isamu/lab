import type { Detector } from "../../plugin.ts";
import { taxAmount } from "../tax-amount.ts";

export const detector: Detector = taxAmount;
