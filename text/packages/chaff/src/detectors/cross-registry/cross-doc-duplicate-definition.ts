import type { CrossDetector } from "../../plugin.ts";
import { crossDocDuplicateDefinition } from "../cross-definitions.ts";

export const detector: CrossDetector = crossDocDuplicateDefinition;
