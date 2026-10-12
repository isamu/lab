import type { Detector } from "../../plugin.ts";
import { discountRate } from "../discount-rate.ts";

export const detector: Detector = discountRate;
