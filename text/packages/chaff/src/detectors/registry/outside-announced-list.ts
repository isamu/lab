import type { Detector } from "../../plugin.ts";
import { outsideAnnouncedList } from "../outside-announced-list.ts";

export const detector: Detector = outsideAnnouncedList;
