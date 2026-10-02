import type { Detector } from "../../plugin.ts";
import { duplicateDefinition } from "../structure-tree.ts";

export const detector: Detector = duplicateDefinition;
