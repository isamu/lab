import type { Detector } from "../../plugin.ts";
import { runningBalance } from "../running-balance.ts";

export const detector: Detector = runningBalance;
