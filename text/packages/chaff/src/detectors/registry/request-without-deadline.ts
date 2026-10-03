import type { Detector } from "../../plugin.ts";
import { requestWithoutDeadline } from "../request-owner.ts";

export const detector: Detector = requestWithoutDeadline;
