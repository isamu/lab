import type { Detector } from "../../plugin.ts";
import { shareAmount } from "../share-amount.ts";

export const detector: Detector = shareAmount;
