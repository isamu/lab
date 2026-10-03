import type { CrossDetector } from "../../plugin.ts";
import { crossDocFactConflict } from "../cross-facts.ts";

export const detector: CrossDetector = crossDocFactConflict;
