import type { Detector } from "../../plugin.ts";
import { arrivalBeforeDeparture } from "../time-order.ts";

export const detector: Detector = arrivalBeforeDeparture;
