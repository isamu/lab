import type { Detector } from "../../plugin.ts";
import { bracketNesting } from "../sentence-load.ts";

export const detector: Detector = bracketNesting;
