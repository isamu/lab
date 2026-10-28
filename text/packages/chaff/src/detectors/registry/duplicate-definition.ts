import type { Detector } from "../../plugin.ts";
import { duplicateDefinition } from "../duplicate-definition.ts";

export const detector: Detector = duplicateDefinition;
