import type { Detector } from "../../plugin.ts";
import { dateWeekdayMismatch } from "../structure-tree.ts";

export const detector: Detector = dateWeekdayMismatch;
