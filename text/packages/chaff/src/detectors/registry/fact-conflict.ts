import type { Detector } from "../../plugin.ts";
import { factConflict } from "../fact-consistency.ts";

export const detector: Detector = factConflict;
