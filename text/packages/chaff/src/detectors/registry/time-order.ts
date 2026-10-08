import type { Detector } from "../../plugin.ts";
import { timeOrder } from "../time-order.ts";

export const detector: Detector = timeOrder;
