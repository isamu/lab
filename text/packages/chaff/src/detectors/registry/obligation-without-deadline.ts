import type { Detector } from "../../plugin.ts";
import { obligationWithoutDeadline } from "../obligation-without-deadline.ts";

export const detector: Detector = obligationWithoutDeadline;
