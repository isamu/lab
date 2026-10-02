import type { Detector } from "../../plugin.ts";
import { acronymExpansionConflict } from "../definition-use.ts";

export const detector: Detector = acronymExpansionConflict;
