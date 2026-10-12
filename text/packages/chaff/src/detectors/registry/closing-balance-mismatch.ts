import type { Detector } from "../../plugin.ts";
import { closingBalanceMismatch } from "../closing-balance-mismatch.ts";

export const detector: Detector = closingBalanceMismatch;
