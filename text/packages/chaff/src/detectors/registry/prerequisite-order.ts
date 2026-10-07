import type { Detector } from "../../plugin.ts";
import { prerequisiteOrder } from "../prerequisite-order.ts";

export const detector: Detector = prerequisiteOrder;
