import type { Detector } from "../../plugin.ts";
import { preferredTerm } from "../orthography.ts";

export const detector: Detector = preferredTerm;
