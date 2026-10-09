import type { Detector } from "../../plugin.ts";
import { connectionTimeShort } from "../time-order.ts";

export const detector: Detector = connectionTimeShort;
