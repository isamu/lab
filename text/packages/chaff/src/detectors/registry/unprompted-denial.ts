import type { Detector } from "../../plugin.ts";
import { unpromptedDenial } from "../unprompted-denial.ts";

export const detector: Detector = unpromptedDenial;
