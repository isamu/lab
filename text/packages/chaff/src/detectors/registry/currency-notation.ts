import type { Detector } from "../../plugin.ts";
import { currencyNotation } from "../currency-notation.ts";

export const detector: Detector = currencyNotation;
