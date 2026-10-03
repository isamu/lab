import type { Detector } from "../../plugin.ts";
import { dateWithoutYear } from "../date-year.ts";

export const detector: Detector = dateWithoutYear;
