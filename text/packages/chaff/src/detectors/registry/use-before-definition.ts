import type { Detector } from "../../plugin.ts";
import { useBeforeDefinition } from "../definition-use.ts";

export const detector: Detector = useBeforeDefinition;
