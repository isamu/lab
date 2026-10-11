import type { Detector } from "../../plugin.ts";
import { netAmountMismatch } from "../net-amount-mismatch.ts";

export const detector: Detector = netAmountMismatch;
