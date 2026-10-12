import type { Detector } from "../../plugin.ts";
import { currencyColumnMixDetector } from "../currency-column.ts";

export const detector: Detector = currencyColumnMixDetector;
