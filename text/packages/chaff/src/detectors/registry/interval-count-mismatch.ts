import type { Detector } from "../../plugin.ts";
import { intervalCountMismatch } from "../use-interval.ts";

export const detector: Detector = intervalCountMismatch;
