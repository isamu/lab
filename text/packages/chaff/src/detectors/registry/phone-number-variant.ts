import type { Detector } from "../../plugin.ts";
import { phoneNumberVariant } from "../phone-number-variant.ts";

export const detector: Detector = phoneNumberVariant;
