import type { Detector } from "../../plugin.ts";
import { versionOrder } from "../version-order.ts";

export const detector: Detector = versionOrder;
