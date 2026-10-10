import type { Detector } from "../../plugin.ts";
import { eventDeadline } from "../event-deadline.ts";

export const detector: Detector = eventDeadline;
